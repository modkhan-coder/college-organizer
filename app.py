import os
import re
import json
import uuid
import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

# -------------------------------
# Optional Supabase support
# -------------------------------

SUPABASE_AVAILABLE = False
try:
    from supabase import create_client  # pip install supabase
    SUPABASE_AVAILABLE = True
except Exception:
    SUPABASE_AVAILABLE = False


DATA_FILE = "college_organizer_data.json"  # used only in local fallback mode


def _supabase_cfg() -> Dict[str, str]:
    """
    Supports BOTH secrets formats:

    A) Nested:
      [supabase]
      url = "..."
      anon_key = "..."
      table = "user_data"

    B) Flat:
      SUPABASE_URL = "..."
      SUPABASE_ANON_KEY = "..."
      SUPABASE_TABLE = "user_data"
    """
    try:
        s = st.secrets.get("supabase", {})
        if isinstance(s, dict) and (s.get("url") or s.get("anon_key") or s.get("table")):
            return {
                "url": str(s.get("url", "")).strip(),
                "anon_key": str(s.get("anon_key", "")).strip(),
                "table": str(s.get("table", "user_data")).strip() or "user_data",
            }

        return {
            "url": str(st.secrets.get("SUPABASE_URL", "")).strip(),
            "anon_key": str(st.secrets.get("SUPABASE_ANON_KEY", "")).strip(),
            "table": str(st.secrets.get("SUPABASE_TABLE", "user_data")).strip() or "user_data",
        }
    except Exception:
        return {"url": "", "anon_key": "", "table": "user_data"}


def supabase_enabled() -> bool:
    cfg = _supabase_cfg()
    return SUPABASE_AVAILABLE and bool(cfg["url"]) and bool(cfg["anon_key"])


def _sb():
    """
    Supabase client stored per Streamlit session (important: don't global-cache it).
    """
    cfg = _supabase_cfg()
    if not cfg["url"] or not cfg["anon_key"]:
        return None

    prev = st.session_state.get("_sb_client_meta")
    if not prev or prev.get("url") != cfg["url"] or prev.get("anon_key") != cfg["anon_key"]:
        st.session_state["_sb_client"] = create_client(cfg["url"], cfg["anon_key"])
        st.session_state["_sb_client_meta"] = {"url": cfg["url"], "anon_key": cfg["anon_key"]}

    return st.session_state.get("_sb_client")


def _sb_authed():
    sb = _sb()
    if sb is None:
        return None

    sess = st.session_state.get("sb_session") or {}
    at = sess.get("access_token")
    rt = sess.get("refresh_token")
    if at and rt:
        try:
            sb.auth.set_session(at, rt)
        except Exception:
            # Some versions may not support set_session; still ok
            pass

    return sb


def _jsonable(x: Any) -> Any:
    if isinstance(x, (datetime.datetime, datetime.date)):
        return x.isoformat()
    if isinstance(x, dict):
        return {str(k): _jsonable(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_jsonable(v) for v in x]
    return x


# -------------------------------
# Defaults / constants
# -------------------------------

DEFAULT_LETTER_SCALE_TEXT = (
    "A: 94-100\nA-: 90-93\nB+: 88-89\nB: 84-87\nB-: 80-83\n"
    "C+: 78-79\nC: 74-77\nC-: 70-73\nD: 60-69\nF: 0-59"
)

# Used in CSV import when a course has no grading scheme
DEFAULT_SCHEME: Dict[str, float] = {
    "Homework": 25.0,
    "Quizzes": 20.0,
    "Practice Tests": 20.0,
    "Participation": 10.0,
    "Final Exam": 25.0,
}


# -------------------------------
# Small utility helpers
# -------------------------------

def _now_stamp() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d_%H%M")


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _clean_nan(x: Any) -> Any:
    try:
        if pd.isna(x):
            return None
    except Exception:
        pass
    return x


# -------------------------------
# Letter scale parsing
# -------------------------------

def parse_letter_scale(text: str) -> List[Dict[str, Any]]:
    """
    Accepts lines like:
      A: 94-100
      A-: 90-93
      ...
    Returns list of dicts sorted by min desc.
    """
    scale: List[Dict[str, Any]] = []
    if not text or not text.strip():
        return scale

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        m = re.match(
            r"^([A-Za-z][A-Za-z\+\-]*)\s*[:=]?\s*(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)\s*%?$",
            line,
        )
        if not m:
            raise ValueError(f"Invalid line: {line}")

        letter = m.group(1).upper().strip()
        lo = float(m.group(2))
        hi = float(m.group(4))
        if lo > hi:
            lo, hi = hi, lo

        scale.append({"letter": letter, "min": lo, "max": hi})

    # keep last occurrence if repeated
    dedup: Dict[str, Dict[str, Any]] = {}
    for row in scale:
        dedup[row["letter"]] = row

    out = list(dedup.values())
    out.sort(key=lambda x: float(x["min"]), reverse=True)
    return out


DEFAULT_LETTER_SCALE = parse_letter_scale(DEFAULT_LETTER_SCALE_TEXT)


def percent_to_letter(pct: Optional[float], letter_scale: List[Dict[str, Any]]) -> Optional[str]:
    if pct is None:
        return None
    try:
        x = float(pct)
    except Exception:
        return None

    for row in (letter_scale or []):
        try:
            lo = float(row.get("min", 0))
            hi = float(row.get("max", 0))
            letter = str(row.get("letter", "")).strip()
            if letter and lo <= x <= hi:
                return letter
        except Exception:
            continue

    return None


# -------------------------------
# GPA system (configurable: 4.0, 4.3, or custom)
# -------------------------------

def _default_gpa_system(preset: str = "4.0") -> Dict[str, Any]:
    preset = str(preset or "4.0").strip()

    # Letter -> grade points mapping (editable in Settings)
    letter_points_40 = [
        {"letter": "A+", "points": 4.0},
        {"letter": "A", "points": 4.0},
        {"letter": "A-", "points": 3.7},
        {"letter": "B+", "points": 3.3},
        {"letter": "B", "points": 3.0},
        {"letter": "B-", "points": 2.7},
        {"letter": "C+", "points": 2.3},
        {"letter": "C", "points": 2.0},
        {"letter": "C-", "points": 1.7},
        {"letter": "D+", "points": 1.3},
        {"letter": "D", "points": 1.0},
        {"letter": "D-", "points": 0.7},
        {"letter": "F", "points": 0.0},
    ]

    letter_points_43 = [
        {"letter": "A+", "points": 4.3},
        {"letter": "A", "points": 4.0},
        {"letter": "A-", "points": 3.7},
        {"letter": "B+", "points": 3.3},
        {"letter": "B", "points": 3.0},
        {"letter": "B-", "points": 2.7},
        {"letter": "C+", "points": 2.3},
        {"letter": "C", "points": 2.0},
        {"letter": "C-", "points": 1.7},
        {"letter": "D+", "points": 1.3},
        {"letter": "D", "points": 1.0},
        {"letter": "D-", "points": 0.7},
        {"letter": "F", "points": 0.0},
    ]

    # Percent bands fallback (used if mode=percent OR if letter conversion can’t find a match)
    percent_points_40 = [
        {"min": 93.0, "max": 100.0, "points": 4.0},
        {"min": 90.0, "max": 92.999, "points": 3.7},
        {"min": 87.0, "max": 89.999, "points": 3.3},
        {"min": 83.0, "max": 86.999, "points": 3.0},
        {"min": 80.0, "max": 82.999, "points": 2.7},
        {"min": 77.0, "max": 79.999, "points": 2.3},
        {"min": 73.0, "max": 76.999, "points": 2.0},
        {"min": 70.0, "max": 72.999, "points": 1.7},
        {"min": 65.0, "max": 69.999, "points": 1.0},
        {"min": 0.0, "max": 64.999, "points": 0.0},
    ]

    percent_points_43 = [
        {"min": 97.0, "max": 100.0, "points": 4.3},
        {"min": 93.0, "max": 96.999, "points": 4.0},
        {"min": 90.0, "max": 92.999, "points": 3.7},
        {"min": 87.0, "max": 89.999, "points": 3.3},
        {"min": 83.0, "max": 86.999, "points": 3.0},
        {"min": 80.0, "max": 82.999, "points": 2.7},
        {"min": 77.0, "max": 79.999, "points": 2.3},
        {"min": 73.0, "max": 76.999, "points": 2.0},
        {"min": 70.0, "max": 72.999, "points": 1.7},
        {"min": 65.0, "max": 69.999, "points": 1.0},
        {"min": 0.0, "max": 64.999, "points": 0.0},
    ]

    if preset == "4.3":
        return {
            "preset": "4.3",
            "mode": "letter",          # "letter" or "percent"
            "max_gpa": 4.3,
            "letter_points": letter_points_43,
            "percent_points": percent_points_43,
        }

    # default 4.0
    return {
        "preset": "4.0",
        "mode": "letter",
        "max_gpa": 4.0,
        "letter_points": letter_points_40,
        "percent_points": percent_points_40,
    }


def _normalize_letter_token(x: Any) -> str:
    return str(x or "").strip().upper().replace(" ", "")


def _coerce_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return float(default)


def _get_gpa_system(user_data: Dict[str, Any]) -> Dict[str, Any]:
    settings = user_data.get("settings") or {}
    sys = settings.get("gpa_system")

    if not isinstance(sys, dict):
        return _default_gpa_system("4.0")

    preset = str(sys.get("preset") or "4.0").strip()
    mode = str(sys.get("mode") or "letter").strip().lower()
    if mode not in ("letter", "percent"):
        mode = "letter"

    max_gpa = _coerce_float(sys.get("max_gpa"), 4.0)
    if max_gpa <= 0:
        max_gpa = 4.0

    # Ensure lists exist
    letter_points = sys.get("letter_points")
    if not isinstance(letter_points, list) or len(letter_points) == 0:
        letter_points = _default_gpa_system("4.3" if preset == "4.3" else "4.0")["letter_points"]

    percent_points = sys.get("percent_points")
    if not isinstance(percent_points, list) or len(percent_points) == 0:
        percent_points = _default_gpa_system("4.3" if preset == "4.3" else "4.0")["percent_points"]

    return {
        "preset": preset if preset in ("4.0", "4.3", "custom") else "4.0",
        "mode": mode,
        "max_gpa": max_gpa,
        "letter_points": letter_points,
        "percent_points": percent_points,
    }


def _letter_points_map(gpa_system: Dict[str, Any]) -> Dict[str, float]:
    mp: Dict[str, float] = {}
    for row in (gpa_system.get("letter_points") or []):
        if not isinstance(row, dict):
            continue
        letter = _normalize_letter_token(row.get("letter"))
        if not letter:
            continue
        mp[letter] = _coerce_float(row.get("points"), 0.0)
    return mp


def _percent_points_rows(gpa_system: Dict[str, Any]) -> List[Dict[str, float]]:
    rows: List[Dict[str, float]] = []
    for row in (gpa_system.get("percent_points") or []):
        if not isinstance(row, dict):
            continue
        lo = _coerce_float(row.get("min"), None)
        hi = _coerce_float(row.get("max"), None)
        pts = _coerce_float(row.get("points"), 0.0)
        if lo is None or hi is None:
            continue
        if lo > hi:
            lo, hi = hi, lo
        rows.append({"min": float(lo), "max": float(hi), "points": float(pts)})

    # Sort by min descending so higher bands win if overlaps exist
    rows.sort(key=lambda r: r["min"], reverse=True)
    return rows


def get_effective_letter_scale(user_data: Dict[str, Any], course: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    course_scale = (course or {}).get("letter_scale") if isinstance(course, dict) else None
    if isinstance(course_scale, list) and course_scale:
        return course_scale

    global_scale = (user_data.get("settings") or {}).get("letter_scale")
    if isinstance(global_scale, list) and global_scale:
        return global_scale

    return DEFAULT_LETTER_SCALE


def percent_to_grade_points(user_data: Dict[str, Any], percent: Optional[float], course: Optional[Dict[str, Any]] = None) -> Optional[float]:
    if percent is None:
        return None
    try:
        pct = float(percent)
    except Exception:
        return None

    gpa_system = _get_gpa_system(user_data)
    max_gpa = _coerce_float(gpa_system.get("max_gpa"), 4.0)

    # 1) Letter-based mode (recommended)
    if gpa_system.get("mode") == "letter":
        scale = get_effective_letter_scale(user_data, course)
        letter = percent_to_letter(pct, scale)
        if letter:
            mp = _letter_points_map(gpa_system)
            pts = mp.get(_normalize_letter_token(letter))
            if pts is not None:
                return round(min(float(pts), float(max_gpa)), 2)

    # 2) Percent-based fallback
    for band in _percent_points_rows(gpa_system):
        if band["min"] <= pct <= band["max"]:
            return round(min(float(band["points"]), float(max_gpa)), 2)

    return 0.0


def get_gpa_max(user_data: Dict[str, Any]) -> float:
    sys = _get_gpa_system(user_data)
    return float(_coerce_float(sys.get("max_gpa"), 4.0))


# -------------------------------
# Calendar export: ICS builder
# -------------------------------

def build_ics_calendar(events: List[Dict[str, Any]], calendar_name: str = "College Organizer") -> str:
    def _escape(s: str) -> str:
        s = str(s or "")
        return (
            s.replace("\\", "\\\\")
             .replace(",", "\\,")
             .replace(";", "\\;")
             .replace("\n", "\\n")
        )

    dtstamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CollegeOrganizer//EN",
        f"X-WR-CALNAME:{_escape(calendar_name)}",
        "CALSCALE:GREGORIAN",
    ]

    for e in (events or []):
        title = _escape(e.get("title", "Event"))
        d = e.get("date")
        if not isinstance(d, datetime.date):
            continue

        dtstart = d.strftime("%Y%m%d")
        dtend = (d + datetime.timedelta(days=1)).strftime("%Y%m%d")
        uid = e.get("uid") or f"co-{dtstart}-{uuid.uuid4().hex}@collegeorganizer"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART;VALUE=DATE:{dtstart}",
            f"DTEND;VALUE=DATE:{dtend}",
            f"SUMMARY:{title}",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\n".join(lines)


# -------------------------------
# Data persistence (LOCAL JSON fallback)
# -------------------------------

def load_data() -> Dict[str, Any]:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {"users": {}}
            data.setdefault("users", {})
            return data
        except Exception:
            return {"users": {}}
    return {"users": {}}


def save_data(data: Dict[str, Any]) -> None:
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    except Exception as e:
        st.error(f"Error saving data: {e}")


def ensure_user_schema(user_data: Dict[str, Any], username: str) -> Dict[str, Any]:
    user_data = user_data or {}

    user_data.setdefault("profile", {})
    user_data["profile"].setdefault("username", username)
    user_data["profile"].setdefault("major", "")
    user_data["profile"].setdefault("school", "")
    user_data["profile"].setdefault("target_gpa", 3.5)

    user_data.setdefault("courses", {})
    user_data.setdefault("assignments", [])
    user_data.setdefault("tasks", [])
    user_data.setdefault("settings", {})

    if not isinstance(user_data["settings"], dict):
        user_data["settings"] = {}

    # default GPA system (editable later in Settings)
    user_data["settings"].setdefault("gpa_system", _default_gpa_system("4.0"))

    # courses list -> dict
    if isinstance(user_data.get("courses"), list):
        new_courses: Dict[str, Any] = {}
        for c in user_data["courses"]:
            if not isinstance(c, dict):
                continue
            cid = str(c.get("course_id") or c.get("id") or generate_id("course"))
            c = dict(c)
            c["course_id"] = cid
            new_courses[cid] = c
        user_data["courses"] = new_courses

    # ensure minimal course fields
    for cid, c in list(user_data["courses"].items()):
        if not isinstance(c, dict):
            user_data["courses"].pop(cid, None)
            continue
        c.setdefault("course_id", str(cid))
        c["course_id"] = str(c["course_id"])
        c.setdefault("name", "Untitled course")
        c.setdefault("code", "")
        c.setdefault("credits", 3.0)
        c.setdefault("grading_scheme", {})
        c.setdefault("letter_scale", [])

    # normalize assignments
    fixed_assignments: List[Dict[str, Any]] = []
    for a in user_data.get("assignments", []):
        if not isinstance(a, dict):
            continue
        a = dict(a)
        a.setdefault("id", generate_id("asg"))
        a["course_id"] = str(a.get("course_id") or "").strip()
        a.setdefault("title", "Untitled assignment")
        a.setdefault("category", "")

        dd = a.get("due_date")
        if isinstance(dd, datetime.date):
            a["due_date"] = dd.isoformat()
        elif isinstance(dd, str):
            a["due_date"] = dd.strip() or None
        else:
            a["due_date"] = None

        if a.get("points_total") is None and a.get("points_possible") is not None:
            a["points_total"] = a.get("points_possible")
        a.pop("points_possible", None)

        a.setdefault("points_total", None)
        a.setdefault("points_earned", None)
        a["is_completed"] = bool(a.get("is_completed", False))

        fixed_assignments.append(a)
    user_data["assignments"] = fixed_assignments

    # normalize tasks
    fixed_tasks: List[Dict[str, Any]] = []
    for t in user_data.get("tasks", []):
        if not isinstance(t, dict):
            continue
        t = dict(t)
        t.setdefault("id", generate_id("task"))

        cid = t.get("course_id")
        if cid is None or str(cid).strip() == "":
            t["course_id"] = None
        else:
            t["course_id"] = str(cid).strip()

        t.setdefault("title", "Untitled task")

        dd = t.get("due_date")
        if isinstance(dd, datetime.date):
            t["due_date"] = dd.isoformat()
        elif isinstance(dd, str):
            t["due_date"] = dd.strip() or None
        else:
            t["due_date"] = None

        t.setdefault("minutes", 0)
        t.setdefault("priority", "Medium")
        t["done"] = bool(t.get("done", False))
        fixed_tasks.append(t)

    user_data["tasks"] = fixed_tasks
    return user_data


# -------------------------------
# User data helpers
# -------------------------------

def init_app_state():
    desired = "supabase" if supabase_enabled() else "local"
    if st.session_state.get("storage_mode") != desired:
        st.session_state.storage_mode = desired

    if st.session_state.storage_mode == "local":
        st.session_state.setdefault("app_data", load_data())

    st.session_state.setdefault("current_user", None)        # uuid in supabase mode; name in local
    st.session_state.setdefault("current_username", None)    # email in supabase mode; name in local
    st.session_state.setdefault("sb_session", None)          # {"access_token":..., "refresh_token":...}


def get_user_data(username: str) -> Dict[str, Any]:
    # Supabase mode (real multi-user)
    if st.session_state.get("storage_mode") == "supabase" and supabase_enabled():
        sb = _sb_authed()
        if sb is None:
            return ensure_user_schema({}, username)

        user_id = st.session_state.get("current_user")
        if not user_id:
            return ensure_user_schema({}, username)

        table = _supabase_cfg().get("table", "user_data")

        try:
            resp = sb.table(table).select("data").eq("user_id", user_id).execute()
            rows = getattr(resp, "data", None)
            if isinstance(rows, list) and rows and isinstance(rows[0], dict):
                data = rows[0].get("data") or {}
            else:
                data = {}
            return ensure_user_schema(data, username)
        except Exception as e:
            st.error(f"Supabase load failed: {e}")
            return ensure_user_schema({}, username)

    # Local JSON mode
    users = st.session_state.app_data.setdefault("users", {})
    user_data = users.setdefault(username, {})
    user_data = ensure_user_schema(user_data, username)
    users[username] = user_data
    return user_data


def save_user_data(username: str, user_data: Dict[str, Any]) -> None:
    # Supabase mode (real multi-user)
    if st.session_state.get("storage_mode") == "supabase" and supabase_enabled():
        sb = _sb_authed()
        if sb is None:
            return

        user_id = st.session_state.get("current_user")
        if not user_id:
            return

        table = _supabase_cfg().get("table", "user_data")

        payload = {
            "user_id": user_id,
            "data": _jsonable(user_data),
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        try:
            sb.table(table).upsert(payload, on_conflict="user_id").execute()
        except Exception as e:
            st.error(f"Supabase save failed: {e}")
        return

    # Local JSON mode
    st.session_state.app_data.setdefault("users", {})
    st.session_state.app_data["users"][username] = user_data
    save_data(st.session_state.app_data)


def get_courses_list(user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    courses = user_data.get("courses", {})
    if isinstance(courses, dict):
        return list(courses.values())
    if isinstance(courses, list):
        return [c for c in courses if isinstance(c, dict)]
    return []


def delete_course_and_related(user_data: Dict[str, Any], course_id: str) -> None:
    user_data.get("courses", {}).pop(course_id, None)
    user_data["assignments"] = [a for a in user_data.get("assignments", []) if a.get("course_id") != course_id]
    user_data["tasks"] = [t for t in user_data.get("tasks", []) if t.get("course_id") != course_id]


def get_assignments_for_course(user_data: Dict[str, Any], course_id: str) -> List[Dict[str, Any]]:
    return [a for a in user_data.get("assignments", []) if a.get("course_id") == course_id]


def get_tasks(user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    return user_data.get("tasks", [])


def add_task(user_data: Dict[str, Any], task: Dict[str, Any]) -> None:
    user_data.setdefault("tasks", []).append(task)


def delete_task(user_data: Dict[str, Any], task_id: str) -> None:
    user_data["tasks"] = [t for t in get_tasks(user_data) if t.get("id") != task_id]


def toggle_task_done(user_data: Dict[str, Any], task_id: str, done: bool) -> None:
    for t in get_tasks(user_data):
        if t.get("id") == task_id:
            t["done"] = bool(done)
            break


def task_exists_for_assignment(user_data: Dict[str, Any], assignment_id: str) -> bool:
    for t in get_tasks(user_data):
        if t.get("source_assignment_id") == assignment_id:
            return True
    return False


def create_task_from_assignment(user_data: Dict[str, Any], assignment: Dict[str, Any], default_minutes: int = 30) -> None:
    cid = assignment.get("course_id")
    cid = str(cid).strip() if cid and str(cid).strip() else None

    due = assignment.get("due_date")
    if isinstance(due, datetime.date):
        due = due.isoformat()
    elif isinstance(due, str):
        due = due.strip() or None
    else:
        due = None

    task = {
        "id": generate_id("task"),
        "title": f"Work on: {assignment.get('title', 'Assignment')}",
        "course_id": cid,
        "due_date": due,
        "minutes": int(default_minutes),
        "priority": "Medium",
        "done": False,
        "created_at": datetime.datetime.now().isoformat(),
        "source_assignment_id": assignment.get("id"),
    }
    add_task(user_data, task)


# -------------------------------
# Grade calculations
# -------------------------------

def normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    weights = weights or {}
    total = sum(max(0.0, float(v)) for v in weights.values())
    if total <= 0:
        n = len(weights) or 1
        return {k: 100.0 / n for k in weights}
    return {k: (float(v) / total) * 100.0 for k, v in weights.items()}


def compute_course_grade(user_data: Dict[str, Any], course: Dict[str, Any]) -> Optional[float]:
    course_id = str(course.get("course_id") or "")
    assignments = get_assignments_for_course(user_data, course_id)
    if not assignments:
        return None

    weights = normalize_weights(course.get("grading_scheme", {}))

    category_scores: Dict[str, Dict[str, float]] = {}
    for a in assignments:
        total = a.get("points_total")
        earned = a.get("points_earned")
        if total is None or earned is None:
            continue
        if float(total) <= 0:
            continue
        cat = str(a.get("category") or "").strip()
        if not cat:
            continue
        cat_data = category_scores.setdefault(cat, {"earned": 0.0, "total": 0.0})
        cat_data["earned"] += float(earned)
        cat_data["total"] += float(total)

    if not category_scores:
        return None

    course_grade = 0.0
    used_weight = 0.0

    for cat, w in weights.items():
        if cat in category_scores and category_scores[cat]["total"] > 0:
            pct = category_scores[cat]["earned"] / category_scores[cat]["total"] * 100.0
            course_grade += pct * (w / 100.0)
            used_weight += w

    if used_weight == 0:
        return None

    if used_weight < 100:
        course_grade = course_grade * (100.0 / used_weight)

    return round(course_grade, 1)


def percent_to_gpa(percent: float) -> float:
    # Legacy mapping (kept for compatibility). The app uses percent_to_grade_points() now.
    if percent >= 93:
        return 4.0
    if percent >= 90:
        return 3.7
    if percent >= 87:
        return 3.3
    if percent >= 83:
        return 3.0
    if percent >= 80:
        return 2.7
    if percent >= 77:
        return 2.3
    if percent >= 73:
        return 2.0
    if percent >= 70:
        return 1.7
    if percent >= 65:
        return 1.0
    return 0.0


def compute_term_gpa(user_data: Dict[str, Any]) -> Optional[float]:
    courses = get_courses_list(user_data)
    if not courses:
        return None

    total_points = 0.0
    total_credits = 0.0

    for c in courses:
        grade = compute_course_grade(user_data, c)
        if grade is None:
            continue
        credits = float(c.get("credits", 0) or 0)
        if credits <= 0:
            continue

        gp = percent_to_grade_points(user_data, grade, course=c)
        if gp is None:
            continue

        total_points += float(gp) * credits
        total_credits += credits

    if total_credits == 0:
        return None

    return round(total_points / total_credits, 2)


def compute_course_grade_with_override(
    user_data: Dict[str, Any],
    course: Dict[str, Any],
    override_pct: Optional[Dict[str, float]] = None
) -> Optional[float]:
    override_pct = override_pct or {}
    course_id = str(course.get("course_id") or "")
    assignments = get_assignments_for_course(user_data, course_id)

    weights = normalize_weights(course.get("grading_scheme", {}))

    category_scores: Dict[str, Dict[str, float]] = {}
    for a in assignments:
        total = a.get("points_total")
        earned = a.get("points_earned")
        if total is None or earned is None or float(total) <= 0:
            continue
        cat = str(a.get("category") or "").strip()
        if not cat:
            continue
        info = category_scores.setdefault(cat, {"earned": 0.0, "total": 0.0})
        info["earned"] += float(earned)
        info["total"] += float(total)

    cats = set(category_scores.keys()) | set(override_pct.keys())
    if not cats:
        return None

    course_grade = 0.0
    used_weight = 0.0

    for cat in cats:
        w = float(weights.get(cat, 0.0))
        if w <= 0:
            continue

        if cat in override_pct:
            pct = float(override_pct[cat])
        else:
            info = category_scores.get(cat)
            if not info or info["total"] <= 0:
                continue
            pct = info["earned"] / info["total"] * 100.0

        course_grade += pct * (w / 100.0)
        used_weight += w

    if used_weight == 0:
        return None
    if used_weight < 100:
        course_grade = course_grade * (100.0 / used_weight)

    return round(course_grade, 1)


# -------------------------------
# Unified feed + filtering
# -------------------------------

def build_integrated_items(user_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    def _cid(x) -> Optional[str]:
        if x is None:
            return None
        s = str(x).strip()
        return s or None

    def course_label(cid: Optional[str]) -> str:
        if not cid:
            return "General"
        c = user_data.get("courses", {}).get(cid)
        if not c:
            return "Unknown course"
        name = str(c.get("name", "")).strip()
        code = str(c.get("code", "")).strip()
        return name + (f" ({code})" if code else "")

    for a in user_data.get("assignments", []):
        due_iso = a.get("due_date")
        if not due_iso:
            continue
        try:
            due = datetime.date.fromisoformat(due_iso)
        except Exception:
            continue

        cid = _cid(a.get("course_id"))
        items.append({
            "kind": "assignment",
            "id": a.get("id"),
            "title": a.get("title", "Untitled assignment"),
            "course_id": cid,
            "course_name": course_label(cid),
            "category": a.get("category", ""),
            "due": due,
            "done": bool(a.get("is_completed", False)),
            "graded": a.get("points_earned") is not None,
        })

    for t in user_data.get("tasks", []):
        due_iso = t.get("due_date")
        if not due_iso:
            continue
        try:
            due = datetime.date.fromisoformat(due_iso)
        except Exception:
            continue

        cid = _cid(t.get("course_id"))
        items.append({
            "kind": "task",
            "id": t.get("id"),
            "title": t.get("title", "Untitled task"),
            "course_id": cid,
            "course_name": course_label(cid),
            "category": "Task",
            "due": due,
            "done": bool(t.get("done", False)),
            "minutes": int(t.get("minutes", 0) or 0),
            "priority": t.get("priority", "Medium"),
        })

    kind_rank = {"assignment": 0, "task": 1}
    items.sort(key=lambda x: (x["due"], kind_rank.get(x["kind"], 9), str(x["title"]).lower()))
    return items


def filter_items(
    items: List[Dict[str, Any]],
    *,
    query: str = "",
    kind: Optional[str] = None,
    course_id: Optional[str] = None,
    status: str = "All",
    start: Optional[datetime.date] = None,
    end: Optional[datetime.date] = None,
) -> List[Dict[str, Any]]:
    q = (query or "").strip().lower()
    kind_norm = None if (kind is None or str(kind).lower() == "all") else str(kind)

    out = []
    for x in items:
        if q:
            hay = " ".join([
                str(x.get("title", "")),
                str(x.get("course_name", "")),
                str(x.get("category", "")),
                str(x.get("kind", "")),
            ]).lower()
            if q not in hay:
                continue

        if kind_norm and x.get("kind") != kind_norm:
            continue

        if course_id is not None and x.get("course_id") != course_id:
            continue

        if status != "All":
            is_done = bool(x.get("done", False))
            if status == "Open" and is_done:
                continue
            if status == "Done" and not is_done:
                continue

        due = x.get("due")
        if isinstance(due, datetime.date):
            if start and due < start:
                continue
            if end and due > end:
                continue

        out.append(x)

    return out


# -------------------------------
# UI: user selector (Supabase auth OR local)
# -------------------------------

def user_selector():
    # Supabase mode (real multi-user)
    if st.session_state.get("storage_mode") == "supabase" and supabase_enabled():
        st.sidebar.header("Account")

        sb = _sb_authed()
        if sb is None:
            st.sidebar.error("Supabase client not available. Check secrets and requirements.txt.")
            return

        # If we already have user info in session, show it
        if st.session_state.get("current_user") and st.session_state.get("current_username"):
            st.sidebar.success(f"Signed in as: {st.session_state.current_username}")
            if st.sidebar.button("Sign out", key="sb_signout"):
                try:
                    sb.auth.sign_out()
                except Exception:
                    pass
                for k in ["current_user", "current_username", "sb_session", "_sb_client", "_sb_client_meta"]:
                    st.session_state.pop(k, None)
                st.rerun()
            return

        mode = st.sidebar.radio("Choose:", ["Log in", "Sign up"], key="sb_mode")
        email = st.sidebar.text_input("Email", key="sb_email").strip()
        password = st.sidebar.text_input("Password", type="password", key="sb_password")

        def _get_attr(obj, name, default=None):
            if isinstance(obj, dict):
                return obj.get(name, default)
            return getattr(obj, name, default)

        if mode == "Log in":
            if st.sidebar.button("Log in", type="primary", key="sb_login_btn"):
                if not email or not password:
                    st.sidebar.error("Enter email and password.")
                    return
                try:
                    sb0 = _sb()
                    res = sb0.auth.sign_in_with_password({"email": email, "password": password})

                    sess = _get_attr(res, "session", None)
                    user = _get_attr(res, "user", None) or _get_attr(sess, "user", None)

                    access = _get_attr(sess, "access_token", None)
                    refresh = _get_attr(sess, "refresh_token", None)

                    uid = _get_attr(user, "id", None)
                    uemail = _get_attr(user, "email", None)

                    if not (uid and uemail and access and refresh):
                        st.sidebar.error("Login failed. Double-check email/password.")
                        return

                    st.session_state.sb_session = {"access_token": str(access), "refresh_token": str(refresh)}
                    st.session_state.current_user = str(uid)
                    st.session_state.current_username = str(uemail)
                    st.rerun()
                except Exception as e:
                    st.sidebar.error(f"Login failed: {e}")

        else:
            st.sidebar.caption("You may need to confirm your email depending on Supabase Auth settings.")
            if st.sidebar.button("Create account", type="primary", key="sb_signup_btn"):
                if not email or not password:
                    st.sidebar.error("Enter email and password.")
                    return
                try:
                    sb0 = _sb()
                    _ = sb0.auth.sign_up({"email": email, "password": password})
                    st.sidebar.success("Account created. Now log in (and confirm email if required).")
                except Exception as e:
                    st.sidebar.error(f"Sign up failed: {e}")

        return

    # Local JSON mode
    st.sidebar.caption("Local mode (not real multi-user). Add Supabase secrets to enable accounts.")
    st.sidebar.header("Student")

    app_data = st.session_state.app_data
    existing_users = sorted(app_data.get("users", {}).keys())

    mode = st.sidebar.radio("Choose:", ["Log in", "New student"], key="mode_user_selector")

    if mode == "Log in":
        if existing_users:
            selected = st.sidebar.selectbox("Select your name", existing_users, key="login_select_name")
            if st.sidebar.button("Use this profile", key="login_use_profile"):
                st.session_state.current_user = selected
                st.session_state.current_username = selected
        else:
            st.sidebar.info("No students yet. Create one below.")

    if mode == "New student":
        new_name = st.sidebar.text_input("Enter your name", key="new_student_name")
        if st.sidebar.button("Create profile", key="new_student_create"):
            name = new_name.strip()
            if not name:
                st.sidebar.error("Please enter a valid name.")
            else:
                _ = get_user_data(name)
                save_user_data(name, get_user_data(name))
                st.session_state.current_user = name
                st.session_state.current_username = name
                st.sidebar.success(f"Profile created for {name}")


# -------------------------------
# Notifications (banner/toast)
# -------------------------------

def _notification_counts(user_data: Dict[str, Any]) -> Dict[str, int]:
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)

    tasks = user_data.get("tasks", [])
    assignments = user_data.get("assignments", [])

    overdue = 0
    due_today = 0
    due_tomorrow = 0

    for t in tasks:
        due_iso = t.get("due_date")
        if not due_iso or bool(t.get("done", False)):
            continue
        try:
            d = datetime.date.fromisoformat(due_iso)
        except Exception:
            continue
        if d < today:
            overdue += 1
        elif d == today:
            due_today += 1
        elif d == tomorrow:
            due_tomorrow += 1

    # assignments: "open" = not graded yet (points_earned is None)
    for a in assignments:
        due_iso = a.get("due_date")
        if not due_iso:
            continue
        if a.get("points_earned") is not None:
            continue
        try:
            d = datetime.date.fromisoformat(due_iso)
        except Exception:
            continue
        if d < today:
            overdue += 1
        elif d == today:
            due_today += 1
        elif d == tomorrow:
            due_tomorrow += 1

    return {"overdue": overdue, "today": due_today, "tomorrow": due_tomorrow}


def maybe_show_notifications(user_data: Dict[str, Any]) -> None:
    settings = user_data.get("settings") or {}
    if not settings.get("notify_enabled", True):
        return

    today_str = datetime.date.today().isoformat()
    uname = user_data.get("profile", {}).get("username", "user")
    state_key = f"notify_last_shown_{uname}"

    if st.session_state.get(state_key) == today_str:
        return

    counts = _notification_counts(user_data)
    if counts["overdue"] == 0 and counts["today"] == 0 and counts["tomorrow"] == 0:
        st.session_state[state_key] = today_str
        return

    msg = f"Overdue: {counts['overdue']} · Today: {counts['today']} · Tomorrow: {counts['tomorrow']}"

    if settings.get("notify_toast", True):
        try:
            st.toast(msg)
        except Exception:
            pass

    if settings.get("notify_banner", True):
        st.warning(f"🔔 Reminders — {msg}")

    st.session_state[state_key] = today_str


# -------------------------------
# UI: Summary
# -------------------------------

def summary_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"summary_{username}"

    st.header("Summary")

    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    week_end = today + datetime.timedelta(days=6)

    items = build_integrated_items(user_data)

    # open items with valid due dates
    open_items = [
        x for x in items
        if isinstance(x.get("due"), datetime.date) and not bool(x.get("done", False))
    ]

    overdue = [x for x in open_items if x["due"] < today]
    due_today = [x for x in open_items if x["due"] == today]
    due_tomorrow = [x for x in open_items if x["due"] == tomorrow]
    next7 = [x for x in open_items if today <= x["due"] <= week_end]

    overdue_tasks_minutes = sum(int(x.get("minutes", 0) or 0) for x in overdue if x.get("kind") == "task")
    next7_tasks_minutes = sum(int(x.get("minutes", 0) or 0) for x in next7 if x.get("kind") == "task")

    # --- Top metrics ---
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Overdue", len(overdue), f"{overdue_tasks_minutes} min (tasks)")
    c2.metric("Due today", len(due_today))
    c3.metric("Due tomorrow", len(due_tomorrow))
    c4.metric("Next 7 days", len(next7), f"{next7_tasks_minutes} min (tasks)")

    st.write("---")

    # --- Next up list ---
    st.subheader("Next up")

    def _rank_kind(k: str) -> int:
        return 0 if k == "assignment" else 1

    next_up = sorted(
        open_items,
        key=lambda x: (x["due"], _rank_kind(str(x.get("kind"))), str(x.get("title", "")).lower())
    )[:12]

    if not next_up:
        st.caption("Nothing coming up.")
    else:
        for item in next_up:
            due = item["due"]
            if item.get("kind") == "task":
                done_val = bool(item.get("done", False))
                label = (
                    f"{item.get('title','(Untitled)')} · {item.get('course_name','')} · "
                    f"{item.get('minutes',0)} min · {item.get('priority','Medium')} · Due {due}"
                )
                new_done = st.checkbox(label, value=done_val, key=f"{K}_next_task_{item.get('id','')}")
                if new_done != done_val:
                    toggle_task_done(user_data, item["id"], new_done)
                    save_user_data(username, user_data)
                    st.rerun()

                if st.button("🗑️ Delete task", key=f"{K}_next_del_{item.get('id','')}"):
                    delete_task(user_data, item["id"])
                    save_user_data(username, user_data)
                    st.rerun()
            else:
                status = "Graded" if item.get("graded") else "Not graded yet"
                st.markdown(
                    f"- **{item.get('title','(Untitled)')}** · {item.get('course_name','')} · "
                    f"{item.get('category','')} · Due **{due}** · {status}"
                )

    st.write("---")

    # --- Week table ---
    st.subheader("This week (table)")
    week_rows = []
    for x in next7:
        week_rows.append({
            "Due": x.get("due"),
            "Type": x.get("kind"),
            "Course": x.get("course_name"),
            "Title": x.get("title"),
            "Minutes": int(x.get("minutes", 0) or 0) if x.get("kind") == "task" else "",
            "Priority": x.get("priority", "") if x.get("kind") == "task" else "",
        })

    if week_rows:
        df_week = pd.DataFrame(week_rows).sort_values(["Due", "Type", "Course", "Title"])
        st.dataframe(df_week, use_container_width=True, hide_index=True)
    else:
        st.caption("Nothing due in the next 7 days.")

    st.write("---")

    # --- Grade snapshot ---
    st.subheader("Grades snapshot")
    courses = get_courses_list(user_data)
    grade_rows = []
    for c in courses:
        g = compute_course_grade(user_data, c)
        if g is None:
            continue
        scale = get_effective_letter_scale(user_data, c)
        letter = percent_to_letter(g, scale) or ""
        grade_rows.append({
            "Course": f"{c.get('name','')} ({c.get('code','')})",
            "Grade (%)": g,
            "Letter": letter,
        })

    if grade_rows:
        dfG = pd.DataFrame(grade_rows).sort_values("Grade (%)", ascending=False)
        st.dataframe(dfG, use_container_width=True, hide_index=True)
    else:
        st.caption("Not enough graded work yet to estimate course grades.")

    st.write("---")

    # --- Quick calendar export ---
    with st.expander("📅 Quick calendar export (next 30 days)", expanded=False):
        horizon_days = 30
        base = [x for x in open_items if today <= x["due"] <= today + datetime.timedelta(days=horizon_days)]
        events = calendar_events_from_items(user_data, base)
        ics_text = build_ics_calendar(events, calendar_name=f"College Organizer - {username}")

        st.download_button(
            "Download calendar (.ics)",
            data=ics_text.encode("utf-8"),
            file_name=f"college_organizer_{username}_{_now_stamp()}.ics",
            mime="text/calendar",
            key=f"{K}_ics_download",
        )

        st.caption(f"Calendar will include {len(events)} event(s).")


# -------------------------------
# UI: Courses
# -------------------------------

def courses_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"courses_{username}"

    st.header("Courses")

    courses = get_courses_list(user_data)

    options = ["➕ New course"]
    label_to_course: Dict[str, Dict[str, Any]] = {}

    for c in courses:
        cid = c.get("course_id", "")
        short = str(cid)[-6:] if cid else "------"
        label = f"{c.get('name','')} ({c.get('code','')}) · {short}"
        options.append(label)
        label_to_course[label] = c

    choice = st.selectbox("Choose a course to add or edit", options, key=f"{K}_choose_course")

    is_new = choice == "➕ New course"
    course = None if is_new else label_to_course[choice]

    st.markdown("### Course details")

    if is_new:
        name = st.text_input("Course name", placeholder="College Algebra", key=f"{K}_name_new")
        code = st.text_input("Course code", placeholder="MATH 1200", key=f"{K}_code_new")
        credits = st.number_input("Credits", min_value=0.5, max_value=10.0, value=3.0, step=0.5, key=f"{K}_credits_new")
        editor_key = f"{K}_grading_editor_new"
        scale_key = f"{K}_letter_scale_new"
        course_id_for_keys = "new"
    else:
        cid = course["course_id"]
        name = st.text_input("Course name", value=course.get("name", ""), key=f"{K}_name_{cid}")
        code = st.text_input("Course code", value=course.get("code", ""), key=f"{K}_code_{cid}")
        credits = st.number_input("Credits", min_value=0.5, max_value=10.0, value=float(course.get("credits", 3.0)), step=0.5, key=f"{K}_credits_{cid}")
        editor_key = f"{K}_grading_editor_{cid}"
        scale_key = f"{K}_letter_scale_{cid}"
        course_id_for_keys = cid

    st.markdown("### Grading categories & weights")
    st.caption("Weights do not need to add up to 100; the app will scale them.")

    if is_new:
        df_init = pd.DataFrame([{"Category": k, "Weight": float(v)} for k, v in DEFAULT_SCHEME.items()])
    else:
        df_init = pd.DataFrame([
            {"Category": cat, "Weight": float(w)}
            for cat, w in (course.get("grading_scheme", {}) or {}).items()
        ])

    categories_df = st.data_editor(df_init, num_rows="dynamic", use_container_width=True, key=editor_key)

    st.subheader("Letter grade scale (optional)")
    existing_scale = [] if is_new else (course.get("letter_scale", []) or [])
    if existing_scale:
        default_scale_text = "\n".join([f"{r['letter']}: {r['min']:.0f}-{r['max']:.0f}" for r in existing_scale])
    else:
        default_scale_text = DEFAULT_LETTER_SCALE_TEXT

    letter_scale_text = st.text_area(
        "One per line, like: A: 94-100",
        value=default_scale_text,
        height=160,
        key=scale_key,
    )

    col_save, col_delete = st.columns([3, 1])

    with col_save:
        if st.button("Save course", key=f"{K}_save_course_{course_id_for_keys}"):
            if not name.strip():
                st.error("Course name is required.")
                st.stop()

            grading_scheme: Dict[str, float] = {}
            for _, row in categories_df.iterrows():
                cat = str(row.get("Category", "")).strip()
                try:
                    w = float(row.get("Weight", 0) or 0)
                except Exception:
                    w = 0.0
                if cat and w > 0:
                    grading_scheme[cat] = w

            if not grading_scheme:
                st.error("Please enter at least one category with a positive weight.")
                st.stop()

            try:
                letter_scale = parse_letter_scale(letter_scale_text)
            except ValueError as e:
                st.error(str(e))
                st.stop()

            if is_new:
                course_id = generate_id("course")
                user_data["courses"][course_id] = {
                    "course_id": course_id,
                    "name": name.strip(),
                    "code": code.strip(),
                    "credits": float(credits),
                    "grading_scheme": grading_scheme,
                    "letter_scale": letter_scale,
                }
                st.success(f"Course '{name.strip()}' added.")
            else:
                cid = course["course_id"]
                course["name"] = name.strip()
                course["code"] = code.strip()
                course["credits"] = float(credits)
                course["grading_scheme"] = grading_scheme
                course["letter_scale"] = letter_scale
                user_data["courses"][cid] = course
                st.success(f"Course '{name.strip()}' updated.")

            save_user_data(username, user_data)
            st.rerun()

    with col_delete:
        if not is_new and course is not None:
            if st.button("🗑️ Delete course", key=f"{K}_delete_{course['course_id']}"):
                st.session_state[f"{K}_confirm_delete"] = course["course_id"]

    confirm_key = f"{K}_confirm_delete"
    if (not is_new) and course is not None and st.session_state.get(confirm_key) == course["course_id"]:
        st.warning("Are you sure? This removes the course, assignments, and tasks for that course.")
        cA, cB = st.columns(2)
        with cA:
            if st.button("Yes, delete", key=f"{K}_confirm_yes_{course['course_id']}"):
                cid = course["course_id"]
                delete_course_and_related(user_data, cid)
                save_user_data(username, user_data)
                st.session_state.pop(confirm_key, None)
                st.success("Course deleted.")
                st.rerun()
        with cB:
            if st.button("Cancel", key=f"{K}_confirm_no_{course['course_id']}"):
                st.session_state.pop(confirm_key, None)
                st.rerun()

    st.write("---")
    st.subheader("Your courses")

    courses = get_courses_list(user_data)
    if not courses:
        st.info("No courses yet.")
        return

    for c in courses:
        st.markdown(f"### {c.get('name','')} ({c.get('code','')})")
        st.write(f"- Credits: {c.get('credits', 0)}")
        st.write("- Grading scheme:")
        for cat, w in normalize_weights(c.get("grading_scheme", {})).items():
            st.write(f"  • {cat}: {round(w, 1)}%")
        st.write("")


# -------------------------------
# UI: Assignments
# -------------------------------

def assignments_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"asg_{username}"

    st.header("Assignments")

    courses = get_courses_list(user_data)
    if not courses:
        st.info("Add a course first in the **Courses** tab.")
        return

    # Make labels unique even if two courses share same name/code
    course_labels = {}
    for c in courses:
        cid = c.get("course_id", "")
        short = str(cid)[-6:] if cid else "------"
        lbl = f"{c.get('name','')} ({c.get('code','')}) · {short}"
        course_labels[lbl] = c

    label = st.selectbox("Select course", list(course_labels.keys()), key=f"{K}_course_select")
    course = course_labels[label]
    course_id = course["course_id"]

    st.subheader("Add assignment")

    scheme_categories = list((course.get("grading_scheme") or {}).keys())
    if not scheme_categories:
        st.info("This course has no grading categories yet. Add them in the Courses tab.")
        return

    with st.form(key=f"{K}_add_form", clear_on_submit=True):
        title = st.text_input("Title", placeholder="Quiz 1", key=f"{K}_add_title")
        category = st.selectbox("Category", scheme_categories, key=f"{K}_add_category")
        due_date = st.date_input("Due date", value=datetime.date.today(), key=f"{K}_add_due_date")
        points_total = st.number_input("Total points", min_value=0.0, max_value=1000.0, value=10.0, key=f"{K}_add_total")
        graded = st.checkbox("Already graded?", value=False, key=f"{K}_add_graded")
        points_earned = st.number_input(
            "Points earned (only used if graded)",
            min_value=0.0,
            max_value=1000.0,
            value=0.0,
            key=f"{K}_add_earned",
        )

        submitted = st.form_submit_button("Save assignment")

        if submitted:
            if not title.strip():
                st.error("Assignment title is required.")
            else:
                assignment = {
                    "id": generate_id("asg"),
                    "course_id": course_id,
                    "title": title.strip(),
                    "category": category,
                    "due_date": due_date.isoformat(),
                    "points_total": float(points_total) if points_total > 0 else None,
                    "points_earned": float(points_earned) if graded and points_total > 0 else None,
                    "is_completed": bool(graded),
                }
                user_data["assignments"].append(assignment)
                save_user_data(username, user_data)
                st.success(f"Assignment '{title.strip()}' saved.")

    st.write("---")
    st.subheader(f"Assignments for {course.get('name','')}")

    course_assignments = get_assignments_for_course(user_data, course_id)
    if not course_assignments:
        st.write("No assignments yet for this course.")
        return

    today = datetime.date.today()
    course_assignments = sorted(course_assignments, key=lambda x: str(x.get("due_date") or ""))

    for a in course_assignments:
        due = None
        try:
            if a.get("due_date"):
                due = datetime.date.fromisoformat(a["due_date"])
        except Exception:
            pass

        status_parts = []
        if a.get("points_earned") is not None and a.get("points_total"):
            pct = round(a["points_earned"] / a["points_total"] * 100.0, 1)
            status_parts.append(f"{a['points_earned']}/{a['points_total']} ({pct}%)")
        else:
            if due and due < today:
                status_parts.append("Past due / not graded")
            else:
                status_parts.append("Not graded yet")

        st.markdown(
            f"**{a.get('title','')}** · {a.get('category','')}  \n"
            f"Due: {a.get('due_date','')} · Status: {'; '.join(status_parts)}"
        )

        # IMPORTANT: make expander labels unique to avoid DuplicateElementId when titles repeat
        short_id = str(a.get("id", ""))[-6:] if a.get("id") else "------"
        with st.expander(f"Edit '{a.get('title','')}' · {short_id}"):
            new_title = st.text_input("Title", value=a.get("title", ""), key=f"{K}_title_{a['id']}")
            new_category = st.selectbox(
                "Category",
                scheme_categories,
                index=scheme_categories.index(a["category"]) if a.get("category") in scheme_categories else 0,
                key=f"{K}_cat_{a['id']}",
            )
            new_due = st.date_input(
                "Due date",
                value=datetime.date.fromisoformat(a["due_date"]) if a.get("due_date") else datetime.date.today(),
                key=f"{K}_due_{a['id']}",
            )
            new_total = st.number_input(
                "Total points",
                min_value=0.0,
                max_value=1000.0,
                value=float(a.get("points_total") or 0.0),
                key=f"{K}_total_{a['id']}",
            )
            new_completed = st.checkbox(
                "Graded / completed",
                value=bool(a.get("is_completed", False)),
                key=f"{K}_done_{a['id']}",
            )
            new_earned = st.number_input(
                "Points earned",
                min_value=0.0,
                max_value=1000.0,
                value=float(a.get("points_earned") or 0.0),
                key=f"{K}_earned_{a['id']}",
            )

            col_u, col_d = st.columns(2)
            with col_u:
                if st.button("Save changes", key=f"{K}_save_{a['id']}"):
                    a["title"] = new_title.strip() or a["title"]
                    a["category"] = new_category
                    a["due_date"] = new_due.isoformat()
                    a["points_total"] = float(new_total) if new_total > 0 else None
                    a["is_completed"] = bool(new_completed)
                    a["points_earned"] = float(new_earned) if new_completed and new_total > 0 else None

                    save_user_data(username, user_data)
                    st.success("Assignment updated.")
                    st.rerun()

            with col_d:
                if st.button("Delete assignment", key=f"{K}_del_{a['id']}"):
                    user_data["assignments"] = [x for x in user_data["assignments"] if x.get("id") != a["id"]]
                    save_user_data(username, user_data)
                    st.warning("Assignment deleted.")
                    st.rerun()


def _course_label_from_id(user_data: Dict[str, Any], course_id: Optional[str]) -> str:
    if not course_id:
        return "General"
    c = user_data.get("courses", {}).get(course_id)
    if not c:
        return "Unknown course"
    name = str(c.get("name", "Course")).strip()
    code = str(c.get("code", "")).strip()
    return (f"{name} ({code})" if code else name).strip()


def calendar_events_from_items(user_data: Dict[str, Any], items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    events = []
    for x in (items or []):
        due = x.get("due")
        if not isinstance(due, datetime.date):
            continue

        kind = x.get("kind", "item")
        title = x.get("title", "(Untitled)")
        course_lbl = _course_label_from_id(user_data, x.get("course_id"))

        if kind == "assignment":
            ev_title = f"Assignment: {title} · {course_lbl}"
        elif kind == "task":
            ev_title = f"Task: {title} · {course_lbl}"
        else:
            ev_title = f"{title} · {course_lbl}"

        events.append({"title": ev_title, "date": due})
    return events


# -------------------------------
# UI: Planner
# -------------------------------

def planner_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"planner_{username}"

    st.header("Planner")

    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)

    courses = get_courses_list(user_data)
    integrated_items = build_integrated_items(user_data)

    st.subheader("Search & filters")

    filter_course_options = [("All courses", None)]
    for c in courses:
        cid = c.get("course_id", "")
        short = str(cid)[-6:] if cid else "------"
        filter_course_options.append((f"{c.get('name','')} ({c.get('code','')}) · {short}", c.get("course_id")))

    fcol1, fcol2, fcol3 = st.columns([3, 2, 2])
    with fcol1:
        q = st.text_input("Search", placeholder="Type: quiz, homework, etc.", key=f"{K}_search")
    with fcol2:
        kind_choice = st.selectbox("Type", ["All", "assignment", "task"], index=0, key=f"{K}_kind")
    with fcol3:
        status_choice = st.selectbox("Status", ["All", "Open", "Done"], index=0, key=f"{K}_status")

    fcol4, fcol5 = st.columns([2, 2])
    with fcol4:
        course_choice_label = st.selectbox("Course", [x[0] for x in filter_course_options], key=f"{K}_course")
        chosen_course_id = dict(filter_course_options).get(course_choice_label)
    with fcol5:
        date_mode = st.selectbox("Date range", ["Any", "Today", "Next 7 days", "Custom"], index=0, key=f"{K}_date_mode")

    start_date = None
    end_date = None
    if date_mode == "Today":
        start_date = today
        end_date = today
    elif date_mode == "Next 7 days":
        start_date = today
        end_date = today + datetime.timedelta(days=6)
    elif date_mode == "Custom":
        cA, cB = st.columns(2)
        with cA:
            start_date = st.date_input("From", value=today, key=f"{K}_from")
        with cB:
            end_date = st.date_input("To", value=today + datetime.timedelta(days=7), key=f"{K}_to")

    filtered = filter_items(
        integrated_items,
        query=q,
        kind=None if kind_choice == "All" else kind_choice,
        course_id=chosen_course_id,
        status=status_choice,
        start=start_date,
        end=end_date,
    )

    st.caption(f"Showing **{len(filtered)}** item(s) based on your filters.")

    # Calendar export (ICS)
    with st.expander("📅 Calendar export (ICS)", expanded=False):
        horizon_label = st.selectbox(
            "Export horizon",
            ["7 days", "30 days", "90 days", "All (not recommended if you have lots)"],
            index=1,
            key=f"{K}_ics_horizon",
        )
        only_filtered = st.checkbox(
            "Export only items that match my current filters",
            value=True,
            key=f"{K}_ics_only_filtered",
        )
        include_done = st.checkbox(
            "Include completed / done items",
            value=False,
            key=f"{K}_ics_include_done",
        )

        if horizon_label == "7 days":
            horizon_days = 7
        elif horizon_label == "30 days":
            horizon_days = 30
        elif horizon_label == "90 days":
            horizon_days = 90
        else:
            horizon_days = None

        base = filtered if only_filtered else integrated_items

        today0 = datetime.date.today()
        trimmed = []
        for x in base:
            due = x.get("due")
            if not isinstance(due, datetime.date):
                continue
            if (horizon_days is not None) and not (today0 <= due <= today0 + datetime.timedelta(days=horizon_days)):
                continue
            if not include_done and bool(x.get("done", False)):
                continue
            trimmed.append(x)

        events = calendar_events_from_items(user_data, trimmed)
        ics_text = build_ics_calendar(events, calendar_name=f"College Organizer - {username}")

        st.download_button(
            "Download calendar (.ics)",
            data=ics_text.encode("utf-8"),
            file_name=f"college_organizer_{username}_{_now_stamp()}.ics",
            mime="text/calendar",
            key=f"{K}_ics_download",
        )

        st.caption(f"Calendar will include {len(events)} event(s).")

    st.write("---")

    # Reminders
    st.subheader("Reminders")

    due_soon = [x for x in filtered if x.get("due") in [today, tomorrow] and not bool(x.get("done", False))]

    if not due_soon:
        st.write("No reminders for today or tomorrow.")
    else:
        for item in due_soon:
            if item["kind"] == "assignment":
                status = "Graded" if item.get("graded") else "Not graded yet"
                st.markdown(
                    f"- **{item.get('title','(Untitled)')}** · {item.get('course_name','')} · {item.get('category','')}  \n"
                    f"Due: {item['due']} · Status: {status}"
                )
            else:
                st.markdown(
                    f"- **{item.get('title','(Untitled)')}** · {item.get('course_name','')} · "
                    f"{item.get('minutes',0)} min · {item.get('priority','Medium')}  \n"
                    f"Due: {item['due']}"
                )

    st.write("---")

    # Next 7 days
    st.subheader("Next 7 days")
    for i in range(7):
        d = today + datetime.timedelta(days=i)
        st.markdown(f"### {d.strftime('%A, %b %d')}")

        day_items = [x for x in filtered if x.get("due") == d]
        if not day_items:
            st.caption("No tasks or assignments.")
            continue

        for item in day_items:
            if item["kind"] == "task":
                done_val = bool(item.get("done", False))
                new_done = st.checkbox(
                    f"{item['title']} · {item['course_name']} · {item.get('minutes',0)} min · {item.get('priority','Medium')}",
                    value=done_val,
                    key=f"{K}_wk_task_{item['id']}",
                )
                if new_done != done_val:
                    toggle_task_done(user_data, item["id"], new_done)
                    save_user_data(username, user_data)
                    st.rerun()

                if st.button("🗑️ Delete task", key=f"{K}_del_task_{item['id']}"):
                    delete_task(user_data, item["id"])
                    save_user_data(username, user_data)
                    st.rerun()

            else:
                status = "Graded" if item.get("graded") else "Not graded yet"
                st.markdown(f"- **{item['title']}** · {item['course_name']} · {item.get('category','')} · {status}")

                assignment_obj = next((a for a in user_data.get("assignments", []) if a.get("id") == item["id"]), None)
                if assignment_obj and not task_exists_for_assignment(user_data, assignment_obj["id"]):
                    mins = st.number_input(
                        "Minutes",
                        min_value=5,
                        max_value=600,
                        value=30,
                        step=5,
                        key=f"{K}_plan_minutes_{item['id']}",
                    )
                    if st.button("Plan study time for this", key=f"{K}_plan_btn_{item['id']}"):
                        create_task_from_assignment(user_data, assignment_obj, default_minutes=int(mins))
                        save_user_data(username, user_data)
                        st.success("Task created from assignment.")
                        st.rerun()
                elif assignment_obj:
                    st.caption("✅ Study time already planned.")


# -------------------------------
# UI: GPA view
# -------------------------------

def gpa_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"gpa_{username}"

    st.header("GPA & Grades")

    courses = get_courses_list(user_data)
    if not courses:
        st.info("Add some courses first.")
        return

    max_gpa = get_gpa_max(user_data)

    st.subheader("Course grades")
    for c in courses:
        grade = compute_course_grade(user_data, c)
        st.markdown(f"### {c.get('name','')} ({c.get('code','')})")
        if grade is None:
            st.write("Not enough graded work yet.")
        else:
            gp = percent_to_grade_points(user_data, grade, course=c)
            st.write(f"- Estimated grade: **{grade}%**")
            st.write(f"- Grade points ({max_gpa:.2f} scale): **{gp if gp is not None else ''}**")
            letter = percent_to_letter(grade, get_effective_letter_scale(user_data, c))
            if letter:
                st.write(f"- Letter grade: **{letter}**")
        st.write("---")

    st.subheader("Estimated term GPA")
    gpa = compute_term_gpa(user_data)
    if gpa is None:
        st.write("Not enough data yet to estimate GPA.")
    else:
        st.markdown(f"## 🎓 {gpa}  (on a {max_gpa:.2f} scale)")

    st.write("---")

    st.subheader("What do I need on the final?")

    course_labels = {}
    for c in courses:
        cid = c.get("course_id", "")
        short = str(cid)[-6:] if cid else "------"
        lbl = f"{c.get('name','')} ({c.get('code','')}) · {short}"
        course_labels[lbl] = c

    chosen_label = st.selectbox("Choose a course", list(course_labels.keys()), key=f"{K}_final_course")
    course = course_labels[chosen_label]
    course_id = course["course_id"]

    cats = list((course.get("grading_scheme") or {}).keys())
    if not cats:
        st.info("This course does not have a grading scheme yet. Add one in the Courses tab.")
        return

    default_index = cats.index("Final Exam") if "Final Exam" in cats else 0
    final_cat = st.selectbox("Which category is the final?", cats, index=default_index, key=f"{K}_final_cat_{course_id}")

    target_grade = st.number_input(
        "Target overall course grade (%)",
        min_value=0.0,
        max_value=100.0,
        value=90.0,
        step=1.0,
        key=f"{K}_target_{course_id}",
    )

    if st.button("Calculate required score", key=f"{K}_calc_{course_id}"):
        grade_if_zero = compute_course_grade_with_override(user_data, course, {final_cat: 0.0})
        grade_if_full = compute_course_grade_with_override(user_data, course, {final_cat: 100.0})

        if grade_if_zero is None or grade_if_full is None:
            st.info("I need at least one graded category (besides the final) to estimate this.")
            return

        if abs(grade_if_full - grade_if_zero) < 1e-6:
            st.info(f"The '{final_cat}' category currently has almost no effect on your grade.")
            return

        diff = grade_if_full - grade_if_zero
        required_pct = 100.0 * (target_grade - grade_if_zero) / diff
        best_possible = max(grade_if_zero, grade_if_full)

        if required_pct <= 0:
            st.success(f"Even with **0%** on the final, you'd be around **{grade_if_zero:.1f}%**.")
        elif required_pct > 100:
            st.warning(f"Even with **100%**, best is about **{best_possible:.1f}%**. Target not reachable.")
        else:
            required_pct = max(0.0, min(100.0, required_pct))
            st.success(f"You need about **{required_pct:.1f}%** on the **{final_cat}**.")


# -------------------------------
# CSV Import/Export
# -------------------------------

def _course_code_map(user_data: Dict[str, Any]) -> Dict[str, str]:
    m = {}
    for cid, c in (user_data.get("courses") or {}).items():
        code = str(c.get("code", "")).strip().upper()
        if code:
            m[code] = cid
    return m


def export_user_csvs(user_data: Dict[str, Any]) -> Dict[str, str]:
    courses_df = pd.DataFrame(get_courses_list(user_data))
    assignments_df = pd.DataFrame(user_data.get("assignments", []))
    tasks_df = pd.DataFrame(user_data.get("tasks", []))
    return {
        "courses": courses_df.to_csv(index=False),
        "assignments": assignments_df.to_csv(index=False),
        "tasks": tasks_df.to_csv(index=False),
    }


def import_csvs_into_user(
    user_data: Dict[str, Any],
    courses_df: Optional[pd.DataFrame],
    assignments_df: Optional[pd.DataFrame],
    tasks_df: Optional[pd.DataFrame],
    mode: str = "merge",
) -> Dict[str, Any]:
    user_data.setdefault("courses", {})
    user_data.setdefault("assignments", [])
    user_data.setdefault("tasks", [])

    if mode == "replace":
        if courses_df is not None:
            user_data["courses"] = {}
        if assignments_df is not None:
            user_data["assignments"] = []
        if tasks_df is not None:
            user_data["tasks"] = []

    if courses_df is not None and not courses_df.empty:
        for _, r in courses_df.iterrows():
            row = {k: (None if pd.isna(v) else v) for k, v in r.to_dict().items()}
            cid = str(row.get("course_id") or row.get("id") or "").strip() or generate_id("course")

            grading_scheme = row.get("grading_scheme")
            if isinstance(grading_scheme, str) and grading_scheme.strip():
                try:
                    grading_scheme = json.loads(grading_scheme)
                except Exception:
                    grading_scheme = None

            user_data["courses"][cid] = {
                "course_id": cid,
                "name": str(row.get("name") or row.get("Course name") or row.get("course") or "Imported course").strip(),
                "code": str(row.get("code") or row.get("course_code") or "IMPORTED").strip(),
                "credits": float(row.get("credits") or 3.0),
                "grading_scheme": grading_scheme if isinstance(grading_scheme, dict) and grading_scheme else dict(DEFAULT_SCHEME),
                "letter_scale": row.get("letter_scale") if isinstance(row.get("letter_scale"), list) else [],
            }

    code_map = _course_code_map(user_data)

    def ensure_course_id(course_code: Optional[str]) -> Optional[str]:
        if not course_code:
            return None
        code = str(course_code).strip().upper()
        if not code:
            return None
        if code in code_map:
            return code_map[code]

        new_id = generate_id("course")
        user_data["courses"][new_id] = {
            "course_id": new_id,
            "name": f"Imported {code}",
            "code": code,
            "credits": 3.0,
            "grading_scheme": dict(DEFAULT_SCHEME),
            "letter_scale": [],
        }
        code_map[code] = new_id
        return new_id

    if assignments_df is not None and not assignments_df.empty:
        for _, r in assignments_df.iterrows():
            row = {k: (None if pd.isna(v) else v) for k, v in r.to_dict().items()}
            aid = str(row.get("id") or row.get("assignment_id") or "").strip() or generate_id("asg")

            cid = str(row.get("course_id") or "").strip()
            if not cid:
                cid = ensure_course_id(row.get("course_code") or row.get("code"))

            due_raw = row.get("due_date")
            due = None
            if due_raw is not None:
                try:
                    due = pd.to_datetime(due_raw, errors="coerce").date().isoformat()
                except Exception:
                    due = None

            points_total = row.get("points_total")
            points_earned = row.get("points_earned")
            if points_earned in (None, ""):
                points_earned = None

            user_data["assignments"].append({
                "id": aid,
                "course_id": cid,
                "title": str(row.get("title") or "Untitled").strip(),
                "category": str(row.get("category") or "Homework").strip(),
                "due_date": due,
                "points_total": float(points_total) if points_total not in (None, "") else None,
                "points_earned": float(points_earned) if points_earned is not None else None,
                "is_completed": bool(row.get("is_completed") or (points_earned is not None)),
            })

    if tasks_df is not None and not tasks_df.empty:
        for _, r in tasks_df.iterrows():
            row = {k: (None if pd.isna(v) else v) for k, v in r.to_dict().items()}
            tid = str(row.get("id") or row.get("task_id") or "").strip() or generate_id("task")

            cid = str(row.get("course_id") or "").strip()
            if not cid:
                cid = ensure_course_id(row.get("course_code") or row.get("code"))

            due_raw = row.get("due_date")
            due = None
            if due_raw is not None:
                try:
                    due = pd.to_datetime(due_raw, errors="coerce").date().isoformat()
                except Exception:
                    due = None

            mins = row.get("minutes")
            done = row.get("done")

            user_data["tasks"].append({
                "id": tid,
                "title": str(row.get("title") or "Task").strip(),
                "course_id": cid,
                "due_date": due,
                "minutes": int(float(mins)) if mins not in (None, "") else 0,
                "priority": str(row.get("priority") or "Medium"),
                "done": bool(done) if done not in (None, "") else False,
                "created_at": row.get("created_at") or datetime.datetime.now().isoformat(),
            })

    return user_data


# -------------------------------
# UI: Settings / profile
# -------------------------------

def settings_view(user_data: Dict[str, Any]):
    username = user_data["profile"]["username"]
    K = f"settings_{username}"

    st.header("Profile & Settings")

    profile = user_data["profile"]
    user_data.setdefault("settings", {})
    s = user_data["settings"]

    st.subheader("Notifications")

    prev_enabled = bool(s.get("notify_enabled", True))
    prev_toast = bool(s.get("notify_toast", True))
    prev_banner = bool(s.get("notify_banner", True))

    notify_enabled = st.checkbox("Enable reminders", value=prev_enabled, key=f"{K}_notify_enabled")
    notify_toast = st.checkbox("Show toast notification", value=prev_toast, key=f"{K}_notify_toast")
    notify_banner = st.checkbox("Show banner at top", value=prev_banner, key=f"{K}_notify_banner")

    s["notify_enabled"] = notify_enabled
    s["notify_toast"] = notify_toast
    s["notify_banner"] = notify_banner

    if (notify_enabled, notify_toast, notify_banner) != (prev_enabled, prev_toast, prev_banner):
        save_user_data(username, user_data)

    st.write("---")

    st.subheader("CSV Import / Export")
    csvs = export_user_csvs(user_data)

    c1, c2, c3 = st.columns(3)
    with c1:
        st.download_button("Download courses CSV", data=csvs["courses"], file_name=f"courses_{username}.csv", mime="text/csv", key=f"{K}_dl_courses_csv")
    with c2:
        st.download_button("Download assignments CSV", data=csvs["assignments"], file_name=f"assignments_{username}.csv", mime="text/csv", key=f"{K}_dl_assignments_csv")
    with c3:
        st.download_button("Download tasks CSV", data=csvs["tasks"], file_name=f"tasks_{username}.csv", mime="text/csv", key=f"{K}_dl_tasks_csv")

    st.caption("Import: upload any of the CSVs below. You can upload one, two, or all three.")

    mode = st.radio("Import mode", ["merge", "replace"], horizontal=True, index=0, key=f"{K}_csv_import_mode")

    up_c = st.file_uploader("Upload courses CSV (optional)", type=["csv"], key=f"{K}_up_courses")
    up_a = st.file_uploader("Upload assignments CSV (optional)", type=["csv"], key=f"{K}_up_assignments")
    up_t = st.file_uploader("Upload tasks CSV (optional)", type=["csv"], key=f"{K}_up_tasks")

    def _safe_read_csv(uploaded_file, label: str):
        if uploaded_file is None:
            return None
        try:
            return pd.read_csv(uploaded_file)
        except Exception as e:
            st.error(f"{label}: couldn't read that CSV. ({e})")
            return None

    df_c = _safe_read_csv(up_c, "Courses CSV")
    df_a = _safe_read_csv(up_a, "Assignments CSV")
    df_t = _safe_read_csv(up_t, "Tasks CSV")

    if df_c is not None:
        st.write("Courses preview")
        st.dataframe(df_c.head(20), use_container_width=True)
    if df_a is not None:
        st.write("Assignments preview")
        st.dataframe(df_a.head(20), use_container_width=True)
    if df_t is not None:
        st.write("Tasks preview")
        st.dataframe(df_t.head(20), use_container_width=True)

    if st.button("Import CSV now", key=f"{K}_do_csv_import"):
        user_data = import_csvs_into_user(user_data, df_c, df_a, df_t, mode=mode)
        save_user_data(username, user_data)
        st.success("CSV import complete.")
        st.rerun()

    # ---- GPA system settings (NEW) ----
    st.write("---")
    st.subheader("GPA system")

    s.setdefault("gpa_system", _default_gpa_system("4.0"))
    gpa_sys = _get_gpa_system(user_data)

    preset_labels = ["4.0 (standard)", "4.3 (A+ = 4.3)", "Custom"]
    preset_to_val = {
        "4.0 (standard)": "4.0",
        "4.3 (A+ = 4.3)": "4.3",
        "Custom": "custom",
    }
    val_to_preset_label = {v: k for k, v in preset_to_val.items()}

    current_label = val_to_preset_label.get(gpa_sys.get("preset", "4.0"), "4.0 (standard)")
    chosen_label = st.selectbox("Preset", preset_labels, index=preset_labels.index(current_label), key=f"{K}_gpa_preset")
    chosen_preset = preset_to_val[chosen_label]

    mode_label = "Letter-based (recommended)" if gpa_sys.get("mode") == "letter" else "Percent-based"
    chosen_mode = st.radio(
        "Conversion mode",
        ["Letter-based (recommended)", "Percent-based"],
        index=0 if mode_label.startswith("Letter") else 1,
        horizontal=True,
        key=f"{K}_gpa_mode",
    )
    chosen_mode_val = "letter" if chosen_mode.startswith("Letter") else "percent"

    max_gpa_val = st.number_input(
        "Max GPA (display cap)",
        min_value=0.0,
        max_value=10.0,
        value=float(gpa_sys.get("max_gpa", 4.0)),
        step=0.1,
        key=f"{K}_gpa_max",
    )

    # Build editable tables
    if chosen_mode_val == "letter":
        rows = gpa_sys.get("letter_points") or _default_gpa_system("4.0")["letter_points"]
        df0 = pd.DataFrame([{"Letter": r.get("letter", ""), "Points": r.get("points", 0.0)} for r in rows])
        st.caption("Edit letter → grade points. (Example: A+ can be 4.3 on some schools.)")
        df_edit = st.data_editor(df0, num_rows="dynamic", use_container_width=True, key=f"{K}_gpa_letter_editor")

        new_letter_points: List[Dict[str, Any]] = []
        for _, r in df_edit.iterrows():
            L = _normalize_letter_token(r.get("Letter"))
            if not L:
                continue
            new_letter_points.append({"letter": L, "points": _coerce_float(r.get("Points"), 0.0)})

        new_percent_points = gpa_sys.get("percent_points") or _default_gpa_system("4.0")["percent_points"]

    else:
        rows = gpa_sys.get("percent_points") or _default_gpa_system("4.0")["percent_points"]
        df0 = pd.DataFrame([{"Min %": r.get("min", 0.0), "Max %": r.get("max", 100.0), "Points": r.get("points", 0.0)} for r in rows])
        st.caption("Edit percent bands → grade points.")
        df_edit = st.data_editor(df0, num_rows="dynamic", use_container_width=True, key=f"{K}_gpa_percent_editor")

        new_percent_points: List[Dict[str, Any]] = []
        for _, r in df_edit.iterrows():
            lo = r.get("Min %")
            hi = r.get("Max %")
            pts = r.get("Points")
            if lo is None or hi is None:
                continue
            new_percent_points.append({
                "min": _coerce_float(lo, 0.0),
                "max": _coerce_float(hi, 0.0),
                "points": _coerce_float(pts, 0.0),
            })

        new_letter_points = gpa_sys.get("letter_points") or _default_gpa_system("4.0")["letter_points"]

    cA, cB = st.columns([1, 1])
    with cA:
        if st.button("Save GPA settings", key=f"{K}_gpa_save"):
            if chosen_preset in ("4.0", "4.3"):
                base = _default_gpa_system(chosen_preset)
                base["mode"] = chosen_mode_val
                base["max_gpa"] = float(max_gpa_val)

                # Keep user edits too
                base["letter_points"] = new_letter_points
                base["percent_points"] = new_percent_points

                s["gpa_system"] = base
            else:
                s["gpa_system"] = {
                    "preset": "custom",
                    "mode": chosen_mode_val,
                    "max_gpa": float(max_gpa_val),
                    "letter_points": new_letter_points,
                    "percent_points": new_percent_points,
                }

            user_data["settings"] = s
            save_user_data(username, user_data)
            st.success("GPA settings saved.")
            st.rerun()

    with cB:
        if st.button("Reset to selected preset defaults", key=f"{K}_gpa_reset"):
            if chosen_preset in ("4.0", "4.3"):
                s["gpa_system"] = _default_gpa_system(chosen_preset)
            else:
                s["gpa_system"] = _default_gpa_system("4.0")
                s["gpa_system"]["preset"] = "custom"

            s["gpa_system"]["mode"] = chosen_mode_val
            s["gpa_system"]["max_gpa"] = float(max_gpa_val)
            user_data["settings"] = s
            save_user_data(username, user_data)
            st.success("Reset done.")
            st.rerun()

    st.write("---")

    st.subheader("Profile")
    with st.form(key=f"{K}_profile_form"):
        major = st.text_input("Major / program", value=str(profile.get("major", "")), key=f"{K}_major")
        school = st.text_input("School / university", value=str(profile.get("school", "")), key=f"{K}_school")

        max_gpa_for_input = max(4.0, get_gpa_max(user_data))
        target_gpa = st.number_input(
            "Target GPA",
            min_value=0.0,
            max_value=float(max_gpa_for_input),
            value=float(profile.get("target_gpa") or 3.5),
            step=0.1,
            key=f"{K}_target_gpa",
        )

        submitted = st.form_submit_button("Save profile")
        if submitted:
            profile["major"] = major.strip()
            profile["school"] = school.strip()
            profile["target_gpa"] = float(target_gpa)
            user_data["profile"] = profile
            save_user_data(username, user_data)
            st.success("Profile updated.")

    st.write("---")
    st.subheader("Data info")
    if st.session_state.get("storage_mode") == "supabase":
        st.write("Your data is stored in Supabase (real multi-user).")
    else:
        st.write("Your data is stored on the server running this app (local JSON mode).")

    st.write("---")
    st.subheader("Backup")

    backup_obj = {
        "version": 1,
        "exported_at": datetime.datetime.now().isoformat(),
        "username": username,
        "user_data": user_data,
    }
    backup_json = json.dumps(backup_obj, indent=2, ensure_ascii=False, default=str)

    st.download_button(
        label="Download full backup (JSON)",
        data=backup_json.encode("utf-8"),
        file_name=f"college_organizer_backup_{username}.json",
        mime="application/json",
        key=f"{K}_download_backup",
    )


# -------------------------------
# UI: Analytics
# -------------------------------

def analytics_view(user_data: Dict[str, Any]):
    st.header("Analytics")

    courses = get_courses_list(user_data)
    assignments = user_data.get("assignments", [])
    tasks = user_data.get("tasks", [])
    today = datetime.date.today()

    overdue_tasks = []
    open_tasks = []
    for t in tasks:
        if bool(t.get("done", False)):
            continue
        open_tasks.append(t)
        due_iso = t.get("due_date")
        if not due_iso:
            continue
        try:
            d = datetime.date.fromisoformat(due_iso)
        except Exception:
            continue
        if d < today:
            overdue_tasks.append(t)

    ungraded_assignments = [a for a in assignments if a.get("points_earned") is None]

    c1, c2, c3 = st.columns(3)
    c1.metric("Open tasks", len(open_tasks))
    c2.metric("Overdue tasks", len(overdue_tasks))
    c3.metric("Ungraded assignments", len(ungraded_assignments))

    st.write("---")

    end = today + datetime.timedelta(days=7)
    rows = []
    for t in tasks:
        if not t.get("due_date") or bool(t.get("done", False)):
            continue
        try:
            d = datetime.date.fromisoformat(t["due_date"])
        except Exception:
            continue
        if not (today <= d < end):
            continue
        rows.append({
            "course": _course_label_from_id(user_data, t.get("course_id")),
            "minutes": int(t.get("minutes") or 0),
        })

    st.subheader("Planned study minutes (next 7 days)")
    if rows:
        df = pd.DataFrame(rows).groupby("course", as_index=False)["minutes"].sum().sort_values("minutes", ascending=False)
        st.bar_chart(df.set_index("course")["minutes"])
    else:
        st.caption("No planned minutes in the next 7 days.")

    st.write("---")

    st.subheader("Assignments by category")
    if assignments:
        dfA = pd.DataFrame(assignments)
        if "category" in dfA.columns:
            cat_counts = dfA["category"].fillna("Unknown").value_counts().sort_values(ascending=False)
            st.bar_chart(cat_counts)
        else:
            st.caption("No category column found in assignments.")
    else:
        st.caption("No assignments yet.")

    st.write("---")

    st.subheader("Current grade by course (estimated)")
    grade_rows = []
    for c in courses:
        g = compute_course_grade(user_data, c)
        if g is None:
            continue
        grade_rows.append({"course": _course_label_from_id(user_data, c.get("course_id")), "grade": g})

    if grade_rows:
        dfG = pd.DataFrame(grade_rows).sort_values("grade", ascending=False)
        st.bar_chart(dfG.set_index("course")["grade"])
    else:
        st.caption("Not enough graded work yet to estimate course grades.")


# -------------------------------
# Main
# -------------------------------

def main():
    st.set_page_config(page_title="College Organizer", page_icon="🎓", layout="wide")
    init_app_state()

    st.title("🎓 College Organizer & Grade Calculator")
    user_selector()

    if st.session_state.current_user is None:
        st.info("Sign in (or create/select a profile on the left) to get started.")
        return

    # In Supabase mode, current_user is UUID and current_username is email
    username = st.session_state.current_username or st.session_state.current_user
    user_data = get_user_data(username)

    maybe_show_notifications(user_data)

    tabs = st.tabs(["Summary", "Courses", "Assignments", "Planner", "GPA", "Analytics", "Profile & Setting"])

    with tabs[0]:
        summary_view(user_data)
    with tabs[1]:
        courses_view(user_data)
    with tabs[2]:
        assignments_view(user_data)
    with tabs[3]:
        planner_view(user_data)
    with tabs[4]:
        gpa_view(user_data)
    with tabs[5]:
        analytics_view(user_data)
    with tabs[6]:
        settings_view(user_data)


if __name__ == "__main__":
    main()
