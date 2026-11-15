"""
NASA Open Science Data Repository search, metadata, file discovery, and provenance.

OSDR records describe research investigations. They are never treated as live crew data.
"""

import hashlib
import json
import logging
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import get_connection

logger = logging.getLogger("ASTRA.NASA_OSDR")

CACHED_DIR = os.path.join(PROJECT_ROOT, "data", "cached_osdr")
CACHED_FILE = os.path.join(CACHED_DIR, "datasets.json")
DOWNLOAD_DIR = os.path.join(PROJECT_ROOT, "data", "nasa_downloads")
OSDR_SEARCH_URL = "https://osdr.nasa.gov/osdr/data/search"
OSDR_META_URL = "https://osdr.nasa.gov/osdr/data/osd/meta"
OSDR_FILES_URL = "https://osdr.nasa.gov/osdr/data/osd/files"
OSDR_BASE_URL = "https://osdr.nasa.gov"
RESEARCH_CATEGORIES = {
    "cardiovascular": "cardiovascular",
    "physiological adaptation": "physiological adaptation",
    "sleep and circadian": "sleep circadian",
    "bone and muscle": "bone muscle",
    "immune response": "immune",
    "radiation biology": "radiation",
    "spaceflight environment": "spaceflight environment",
    "human behaviour": "human behavior",
}
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024
ACCESSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
SOURCE_CATEGORY = "REAL_NASA_RESEARCH"


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "; ".join(filter(None, (_text(item) for item in value)))
    if isinstance(value, dict):
        return _text(value.get("Name") or value.get("name") or value.get("annotationValue") or value.get("value"))
    return ""


def _mission_name(value: Any) -> str:
    if isinstance(value, dict):
        return _text(value.get("Name") or value.get("name"))
    return _text(value)


def _osdr_identifier(accession: str) -> str:
    match = re.fullmatch(r"OSD-(\d+)", accession, flags=re.IGNORECASE)
    return match.group(1) if match else accession


def _dataset_from_hit(hit: Dict[str, Any]) -> Dict[str, Any]:
    source = hit.get("_source") or {}
    accession = _text(source.get("Accession") or hit.get("_id"))
    mission = _mission_name(source.get("Mission"))
    return {
        "id": accession,
        "accession": accession,
        "title": _text(source.get("Study Title")) or "Untitled NASA OSDR investigation",
        "description": _text(source.get("Study Description")),
        "organism": _text(source.get("organism") or source.get("Organism")) or "Not specified in search record",
        "subject_type": _text(source.get("Material Type")) or "Not specified in search record",
        "mission": mission or "Not specified in search record",
        "study_design": _text(source.get("Study Protocol Type")) or "Not specified in search record",
        "measurement_type": _text(source.get("Study Assay Measurement Type")) or "Not specified in search record",
        "release_date": _text(source.get("Study Public Release Date")),
        "attribution": "NASA Open Science Data Repository (OSDR)",
        "source_url": f"{OSDR_META_URL}/{urllib.parse.quote(_osdr_identifier(accession), safe='')}",
        "source_category": SOURCE_CATEGORY,
        "provenance": SOURCE_CATEGORY,
        "data_kind": "HISTORICAL_RESEARCH",
        "metadata_available": bool(re.fullmatch(r"OSD-\d+", accession)),
    }


class NASAOSDRClient:
    def __init__(self):
        self.cached_datasets: List[Dict[str, Any]] = []
        self.load_cache()

    def load_cache(self) -> None:
        if not os.path.exists(CACHED_FILE):
            return
        try:
            with open(CACHED_FILE, "r", encoding="utf-8") as cache_file:
                cached = json.load(cache_file)
        except (OSError, json.JSONDecodeError) as error:
            logger.error("Failed to load offline OSDR catalogue: %s", error)
            return
        datasets = cached.get("datasets", []) if isinstance(cached, dict) else []
        if not isinstance(datasets, list):
            logger.error("Offline OSDR catalogue has an invalid datasets list.")
            return
        self.cached_datasets = [
            dataset for dataset in datasets
            if isinstance(dataset, dict) and ACCESSION_PATTERN.fullmatch(str(dataset.get("accession", "")))
        ]
        logger.info("Loaded %s curated NASA OSDR records for offline search.", len(self.cached_datasets))

    def _request_json(self, url: str, timeout: float = 10.0) -> Any:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "ASTRA-Research-Prototype/1.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise urllib.error.HTTPError(url, response.status, "OSDR request failed", response.headers, None)
            return json.loads(response.read().decode("utf-8"))

    def search_datasets(
        self,
        term: str = "spaceflight",
        category: Optional[str] = None,
        page_from: int = 0,
        page_size: int = 10,
    ) -> Dict[str, Any]:
        if not isinstance(term, str) or len(term.strip()) > 120:
            raise ValueError("Search term must be 1 to 120 characters.")
        if not 0 <= page_from <= 10000 or not 1 <= page_size <= 50:
            raise ValueError("Search pagination must use from=0..10000 and size=1..50.")

        search_term = term.strip()
        if category:
            normalized_category = category.strip().lower()
            if normalized_category not in RESEARCH_CATEGORIES:
                raise ValueError(f"Unknown research category: {category}")
            if not search_term or search_term.lower() in {"spaceflight", "all"}:
                search_term = RESEARCH_CATEGORIES[normalized_category]

        query = urllib.parse.urlencode({"term": search_term or "spaceflight", "from": page_from, "size": page_size})
        url = f"{OSDR_SEARCH_URL}?{query}"
        try:
            response = self._request_json(url)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as error:
            logger.info("NASA OSDR search unavailable; using curated offline records: %s", error)
            term_lower = search_term.lower()
            cached = [
                dict(dataset) for dataset in self.cached_datasets
                if term_lower in " ".join(
                    _text(dataset.get(field)) for field in ("title", "description", "category", "organism", "mission")
                ).lower()
            ]
            return self._search_response(cached[page_from:page_from + page_size], len(cached), "CURATED_OFFLINE_CACHE", page_from, page_size)

        hits_obj = response.get("hits", {}) if isinstance(response, dict) else {}
        raw_hits = hits_obj.get("hits", []) if isinstance(hits_obj, dict) else []
        datasets = [_dataset_from_hit(hit) for hit in raw_hits if isinstance(hit, dict)]
        total_obj = hits_obj.get("total", 0) if isinstance(hits_obj, dict) else 0
        total = total_obj.get("value", 0) if isinstance(total_obj, dict) else total_obj
        if not isinstance(total, int):
            total = len(datasets)
        return self._search_response(datasets, total, "NASA_OSDR_API", page_from, page_size)

    @staticmethod
    def _search_response(datasets: List[Dict[str, Any]], total: int, source: str, page_from: int, page_size: int) -> Dict[str, Any]:
        return {
            "source": source,
            "source_category": SOURCE_CATEGORY,
            "provenance": SOURCE_CATEGORY,
            "data_kind": "HISTORICAL_RESEARCH",
            "disclaimer": "NASA OSDR contains heterogeneous historical research. Organism and study population must be checked for each record; research is not live astronaut telemetry.",
            "total": total,
            "from": page_from,
            "size": page_size,
            "datasets": datasets,
        }

    @staticmethod
    def _normalize_accession(dataset_id: str) -> str:
        accession = dataset_id.strip()
        osd_match = re.fullmatch(r"OSD-(\d+)", accession, flags=re.IGNORECASE)
        if osd_match:
            return f"OSD-{osd_match.group(1)}"
        if not ACCESSION_PATTERN.fullmatch(accession):
            raise ValueError("Invalid NASA OSDR accession.")
        return accession

    def _read_cached_detail(self, accession: str) -> Optional[Dict[str, Any]]:
        connection = get_connection()
        try:
            row = connection.execute(
                "SELECT metadata_json, files_json, source_url, fetched_at FROM nasa_dataset_cache WHERE accession = ? ORDER BY fetched_at DESC LIMIT 1",
                (accession,),
            ).fetchone()
        finally:
            connection.close()
        if not row:
            return None
        return {
            "metadata": json.loads(row["metadata_json"]),
            "files": json.loads(row["files_json"]),
            "source_url": row["source_url"],
            "metadata_fetched_at": row["fetched_at"],
        }

    def _curated_record(self, accession: str) -> Optional[Dict[str, Any]]:
        return next((item for item in self.cached_datasets if item.get("accession") == accession), None)

    def _cache_detail(self, accession: str, metadata: Any, files: Any, source_url: str) -> str:
        fetched_at = datetime.now(timezone.utc).isoformat()
        remote_id = _osdr_identifier(accession)
        metadata_key = f"OSD-{remote_id}"
        record = (metadata.get("study") or {}).get(metadata_key, {}) if isinstance(metadata, dict) else {}
        version = str(record.get("version", "unknown"))
        connection = get_connection()
        try:
            connection.execute(
                """
                INSERT INTO nasa_dataset_cache (accession, metadata_version, metadata_json, files_json, source_url, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(accession, metadata_version) DO UPDATE SET
                    metadata_json = excluded.metadata_json,
                    files_json = excluded.files_json,
                    source_url = excluded.source_url,
                    fetched_at = excluded.fetched_at
                """,
                (accession, version, json.dumps(metadata), json.dumps(files), source_url, fetched_at),
            )
            connection.commit()
        finally:
            connection.close()
        return fetched_at

    def get_dataset_metadata(self, dataset_id: str) -> Dict[str, Any]:
        accession = self._normalize_accession(dataset_id)
        remote_id = _osdr_identifier(accession)
        source_url = f"{OSDR_META_URL}/{urllib.parse.quote(remote_id, safe='')}"
        files_url = f"{OSDR_FILES_URL}/{urllib.parse.quote(remote_id, safe='')}"
        try:
            metadata = self._request_json(source_url)
            files = self._request_json(f"{files_url}?page_number=1&page_size=25")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise LookupError(f"NASA OSDR did not return metadata for {accession} (HTTP 404).") from error
            raise ConnectionError(f"NASA OSDR returned HTTP {error.code} for {accession}.") from error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as error:
            cached = self._read_cached_detail(accession)
            if cached:
                return self._build_dataset_detail(accession, cached["metadata"], cached["files"], cached["source_url"], cached["metadata_fetched_at"], "PERSISTED_CACHE")
            curated = self._curated_record(accession)
            if curated:
                return self._build_dataset_detail(accession, {"study": {}, "offline_summary": curated}, {"studies": {}}, source_url, None, "CURATED_OFFLINE_CACHE")
            raise ConnectionError(f"NASA OSDR is unavailable and no cached detail exists for {accession}.") from error

        key = accession if accession.startswith("OSD-") else f"OSD-{accession.removeprefix('OSD-')}"
        study = (metadata.get("study") or {}).get(key) if isinstance(metadata, dict) else None
        file_study = (files.get("studies") or {}).get(key) if isinstance(files, dict) else None
        if not isinstance(study, dict) or not study:
            raise LookupError(f"NASA OSDR has no OSD metadata record for {accession}.")
        if not isinstance(file_study, dict):
            file_study = {}
        fetched_at = self._cache_detail(accession, metadata, files, source_url)
        metadata["offline_summary"] = self._curated_record(accession)
        return self._build_dataset_detail(accession, metadata, files, source_url, fetched_at, "NASA_OSDR_API")

    def _build_dataset_detail(
        self,
        accession: str,
        metadata: Dict[str, Any],
        files_payload: Dict[str, Any],
        source_url: str,
        fetched_at: Optional[str],
        source: str,
    ) -> Dict[str, Any]:
        key = accession if accession.startswith("OSD-") else f"OSD-{accession.removeprefix('OSD-')}"
        study_record = (metadata.get("study") or {}).get(key, {}) if isinstance(metadata, dict) else {}
        studies = study_record.get("studies", []) if isinstance(study_record, dict) else []
        investigation = studies[0] if studies and isinstance(studies[0], dict) else {}
        curated = metadata.get("offline_summary") if isinstance(metadata, dict) else None

        title = _text(investigation.get("title")) or _text((curated or {}).get("title")) or "Title not available in cached NASA metadata"
        description = _text(investigation.get("description")) or _text((curated or {}).get("description"))
        characteristics = investigation.get("characteristicCategories", []) or []
        characteristic_names = [
            _text(item.get("characteristicType", {}).get("annotationValue"))
            for item in characteristics if isinstance(item, dict)
        ]
        organism = "Not specified in metadata"
        if "Organism" in characteristic_names:
            organism = _text((curated or {}).get("organism")) or "See ISA metadata characteristics and study protocols"
        factors = investigation.get("factors", []) or []
        factor_names = [
            _text(item.get("factorName")) or _text(item.get("factorType", {}).get("annotationValue"))
            for item in factors if isinstance(item, dict)
        ]
        assays = investigation.get("assays", []) or []
        measurement_types = [
            _text(item.get("measurementType", {}).get("annotationValue"))
            for item in assays if isinstance(item, dict)
        ]
        protocols = investigation.get("protocols", []) or []
        protocol_descriptions = [
            _text(item.get("description")) for item in protocols
            if isinstance(item, dict) and _text(item.get("description"))
        ]
        file_study = (files_payload.get("studies") or {}).get(key, {}) if isinstance(files_payload, dict) else {}
        raw_files = file_study.get("study_files", []) if isinstance(file_study, dict) else []
        files = self._normalize_files(raw_files)

        validation = self._validate_study(investigation, curated)
        return {
            "dataset": {
                "id": accession,
                "accession": accession,
                "title": title,
                "description": description,
                "organism": organism,
                "subject_type": "; ".join(characteristic_names) or "Not specified",
                "mission": _text((curated or {}).get("mission")) or "See study protocols; no mission inferred",
                "study_design": "; ".join(filter(None, factor_names)) or "Not specified in metadata",
                "measurement_type": "; ".join(filter(None, measurement_types)) or "Not specified in metadata",
                "version": study_record.get("version") if isinstance(study_record, dict) else None,
                "release_date": _text((curated or {}).get("release_date")),
                "data_kind": "HISTORICAL_RESEARCH",
                "source_category": SOURCE_CATEGORY,
                "provenance": SOURCE_CATEGORY,
                "attribution": "NASA Open Science Data Repository (OSDR)",
                "source_url": source_url,
            },
            "source": source,
            "source_category": SOURCE_CATEGORY,
            "data_kind": "HISTORICAL_RESEARCH",
            "metadata_fetched_at": fetched_at,
            "study_summary": {
                "investigation_count": len(studies),
                "organism_characteristics": characteristic_names,
                "factors": factor_names,
                "measurement_types": list(filter(None, measurement_types)),
                "protocol_descriptions": protocol_descriptions[:5],
                "publications": study_record.get("publications", []) if isinstance(study_record, dict) else [],
            },
            "validation": validation,
            "files": files,
            "file_count": file_study.get("file_count", len(files)) if isinstance(file_study, dict) else 0,
            "file_page_total": file_study.get("page_total", 1) if isinstance(file_study, dict) else 1,
            "disclaimer": "Historical research metadata only. It is not current astronaut telemetry and is not imported into personal health records.",
        }

    @staticmethod
    def _validate_study(investigation: Dict[str, Any], curated: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        characteristics = investigation.get("characteristicCategories", []) or []
        characteristic_names = [
            _text(item.get("characteristicType", {}).get("annotationValue"))
            for item in characteristics if isinstance(item, dict)
        ]
        assays = investigation.get("assays", []) or []
        has_measurement = any(
            isinstance(item, dict) and _text(item.get("measurementType", {}).get("annotationValue"))
            for item in assays
        )
        protocols = investigation.get("protocols", []) or []
        has_protocol = any(isinstance(item, dict) and _text(item.get("description")) for item in protocols)
        organism = _text((curated or {}).get("organism"))
        is_human = "homo sapiens" in organism.lower() or "human" in organism.lower()
        checks = [
            {"field": "organism", "status": "DOCUMENTED" if "Organism" in characteristic_names or organism else "MISSING", "value": organism or ("Organism characteristic present; inspect values" if "Organism" in characteristic_names else "Not documented")},
            {"field": "study design", "status": "DOCUMENTED" if has_protocol else "MISSING", "value": "Protocol text available" if has_protocol else "No protocol details found"},
            {"field": "measurement type", "status": "DOCUMENTED" if has_measurement else "MISSING", "value": "Assay measurement type available" if has_measurement else "No assay measurement type found"},
            {"field": "collection timeline", "status": "REQUIRES_REVIEW", "value": "Review protocol and factor values; timeline not inferred automatically"},
            {"field": "units", "status": "REQUIRES_REVIEW", "value": "Units must be verified in the specific assay/data files"},
            {"field": "file accessibility", "status": "REQUIRES_FILE_REVIEW", "value": "Access and visibility are reported per file"},
        ]
        return {
            "status": "RESEARCH_REVIEW_REQUIRED",
            "human_subjects_confirmed": is_human,
            "suitable_for_astronaut_telemetry": False,
            "checks": checks,
            "limitations": [
                "This check summarizes metadata completeness; it is not scientific or clinical validation.",
                "Research measurements are not automatically compatible with ASTRA telemetry, baselines, or clinical rules.",
                "A human subject classification does not establish that subjects were astronauts.",
            ],
        }

    def get_dataset_files(self, dataset_id: str, page: int = 1, page_size: int = 25) -> Dict[str, Any]:
        if page < 1 or page_size < 1 or page_size > 100:
            raise ValueError("File pagination must use page >= 1 and page_size between 1 and 100.")
        detail = self.get_dataset_metadata(dataset_id)
        if page == 1 and page_size == 25:
            return {
                "accession": detail["dataset"]["accession"],
                "source_category": SOURCE_CATEGORY,
                "files": detail["files"],
                "page": 1,
                "page_size": page_size,
                "page_total": detail["file_page_total"],
                "total": detail["file_count"],
                "metadata_source": detail["source"],
            }

        remote_id = _osdr_identifier(detail["dataset"]["accession"])
        url = f"{OSDR_FILES_URL}/{urllib.parse.quote(remote_id, safe='')}?{urllib.parse.urlencode({'page_number': page, 'page_size': page_size})}"
        try:
            payload = self._request_json(url)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ConnectionError("NASA OSDR file listing is unavailable for this page.") from error
        key = f"OSD-{remote_id}"
        file_study = (payload.get("studies") or {}).get(key, {}) if isinstance(payload, dict) else {}
        raw_files = file_study.get("study_files", []) if isinstance(file_study, dict) else []
        files = self._normalize_files(raw_files)
        return {
            "accession": detail["dataset"]["accession"],
            "source_category": SOURCE_CATEGORY,
            "files": files,
            "page": page,
            "page_size": page_size,
            "total": detail["file_count"],
            "page_total": file_study.get("page_total", 1) if isinstance(file_study, dict) else 1,
            "metadata_source": detail["source"],
        }

    @staticmethod
    def _normalize_files(raw_files: Any) -> List[Dict[str, Any]]:
        files = []
        for item in raw_files if isinstance(raw_files, list) else []:
            if not isinstance(item, dict):
                continue
            name = _text(item.get("file_name"))
            remote_url = _text(item.get("remote_url"))
            file_size = item.get("file_size")
            files.append({
                "name": name,
                "size_bytes": int(file_size) if isinstance(file_size, (int, float)) and file_size >= 0 else None,
                "category": _text(item.get("category")),
                "updated_at": item.get("date_updated"),
                "public": not item.get("restricted", True) and item.get("visible", False),
                "download_available": bool(name and remote_url and not item.get("restricted", True) and item.get("visible", False)),
            })
        return files

    def download_public_file(self, dataset_id: str, file_name: str, page: int = 1) -> Dict[str, Any]:
        accession = self._normalize_accession(dataset_id)
        detail = self.get_dataset_metadata(accession)
        file_page = self.get_dataset_files(accession, page=page, page_size=100)
        selected = next((item for item in file_page["files"] if item["name"] == file_name), None)
        if not selected:
            raise LookupError("File is not listed in the NASA OSDR dataset.")
        if not selected["download_available"]:
            raise PermissionError("This NASA OSDR file is restricted or not publicly downloadable.")
        if selected["size_bytes"] is not None and selected["size_bytes"] > MAX_DOWNLOAD_BYTES:
            raise OverflowError(f"File exceeds the {MAX_DOWNLOAD_BYTES // (1024 * 1024)} MB prototype download limit.")

        safe_name = os.path.basename(file_name)
        if safe_name != file_name or safe_name in {"", ".", ".."}:
            raise ValueError("Invalid NASA OSDR filename.")
        key = accession if accession.startswith("OSD-") else f"OSD-{accession.removeprefix('OSD-')}"
        encoded_accession = urllib.parse.quote(key, safe="")
        encoded_file = urllib.parse.quote(file_name, safe="")
        download_url = f"{OSDR_BASE_URL}/geode-py/ws/studies/{encoded_accession}/download?source=datamanager&file={encoded_file}"
        request = urllib.request.Request(download_url, headers={"User-Agent": "ASTRA-Research-Prototype/1.0"})
        target_dir = os.path.join(DOWNLOAD_DIR, safe_name_for_path(accession))
        os.makedirs(target_dir, exist_ok=True)

        digest = hashlib.sha256()
        byte_count = 0
        temp_path = None
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise urllib.error.HTTPError(download_url, response.status, "NASA download failed", response.headers, None)
                with tempfile.NamedTemporaryFile(dir=target_dir, prefix=".download-", delete=False) as target:
                    temp_path = target.name
                    while True:
                        chunk = response.read(64 * 1024)
                        if not chunk:
                            break
                        byte_count += len(chunk)
                        if byte_count > MAX_DOWNLOAD_BYTES:
                            raise OverflowError(f"File exceeds the {MAX_DOWNLOAD_BYTES // (1024 * 1024)} MB prototype download limit.")
                        target.write(chunk)
                        digest.update(chunk)
            checksum = digest.hexdigest()
            final_name = safe_name
            existing_path = os.path.join(target_dir, final_name)
            if os.path.exists(existing_path):
                existing_digest = hashlib.sha256()
                with open(existing_path, "rb") as existing_file:
                    for chunk in iter(lambda: existing_file.read(64 * 1024), b""):
                        existing_digest.update(chunk)
                if existing_digest.hexdigest() != checksum:
                    base, extension = os.path.splitext(safe_name)
                    final_name = f"{base}-{checksum[:12]}{extension}"
            final_path = os.path.join(target_dir, final_name)
            if os.path.exists(final_path):
                os.remove(temp_path)
                temp_path = None
            else:
                os.replace(temp_path, final_path)
                temp_path = None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

        downloaded_at = datetime.now(timezone.utc).isoformat()
        connection = get_connection()
        try:
            connection.execute(
                """
                INSERT INTO nasa_downloads
                    (accession, file_name, stored_path, source_url, sha256, size_bytes, dataset_version, source_category, downloaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (accession, safe_name, os.path.relpath(final_path, PROJECT_ROOT), download_url, checksum, byte_count,
                 detail["dataset"].get("version"), SOURCE_CATEGORY, downloaded_at),
            )
            connection.commit()
        finally:
            connection.close()
        return {
            "accession": accession,
            "file_name": safe_name,
            "stored_file": os.path.relpath(final_path, PROJECT_ROOT),
            "source_url": download_url,
            "sha256": checksum,
            "size_bytes": byte_count,
            "dataset_version": detail["dataset"].get("version"),
            "source_category": SOURCE_CATEGORY,
            "downloaded_at": downloaded_at,
            "original_file_unchanged": True,
        }


def safe_name_for_path(accession: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", accession)


nasa_osdr_client = NASAOSDRClient()
