import time
import uuid
import threading
import subprocess
import socket
import os
RAILWAY_GAME_SERVER_URL = os.getenv("GAME_SERVER_URL") 
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# =====================================================
# CONFIG
# =====================================================

WEBSOCKET_BASE = "http://localhost"
GAME_SERVER_START_PORT = 4000
HEARTBEAT_TIMEOUT_SECONDS = 60
CLEANUP_INTERVAL_SECONDS = 10
COUNTDOWN_SECONDS = 20
MAX_PLAYERS_PER_ROOM = 4


# =====================================================
# DATA MODELS
# =====================================================

class LoginRequest(BaseModel):
    username: str

class LoginResponse(BaseModel):
    session_id: str
    username: str

class CreateRoomRequest(BaseModel):
    session_id: str
    room_name: Optional[str] = None

class CreateRoomResponse(BaseModel):
    room_id: str
    room_name: str
    ws_url: str
    session_id: str

class JoinRoomRequest(BaseModel):
    session_id: str
    room_id: str

class JoinRoomResponse(BaseModel):
    room_id: str
    room_name: str
    ws_url: str
    session_id: str

class HeartbeatRequest(BaseModel):
    session_id: str
    room_id: Optional[str] = None

class ChooseCharacterRequest(BaseModel):
    session_id: str
    room_id: str
    character: str

class RoomInfo(BaseModel):
    room_id: str
    room_name: str
    player_count: int
    state: str
    characters_taken: List[str]
    ws_url: Optional[str]
    countdown: Optional[int] = None   # <-- ADD THIS


class RoomsResponse(BaseModel):
    rooms: List[RoomInfo]


# =====================================================
# IN-MEMORY STORE
# =====================================================

players: Dict[str, Dict] = {}
rooms: Dict[str, Dict] = {}
lock = threading.Lock()


# =====================================================
# PORT CHECKING UTILITIES (NEW!)
# =====================================================

def is_port_available(port: int) -> bool:
    """Check if Python AND Docker can bind to this port."""
    # First: Can Python bind this port?
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.2)
        try:
            s.bind(("0.0.0.0", port))
        except OSError:
            return False

    # Second: Check Docker by inspecting current bindings
    try:
        output = subprocess.check_output(["docker", "ps", "--format", "{{.Ports}}"]).decode()
        if f"0.0.0.0:{port}->" in output:
            return False
    except:
        pass

    return True



def get_free_port(start: int = 4000, end: int = 5000) -> int:
    """Return the first free port — skips any port already taken."""
    for port in range(start, end):
        if is_port_available(port):
            return port
    raise HTTPException(status_code=500, detail="No free ports available for game server")


# =====================================================
# GAME SERVER SPAWNING
# =====================================================

# =====================================================
# GAME SERVER SPAWNING (FINAL PRODUCTION VERSION)
# =====================================================

# Put your WebSocket Railway Game Server URL here:
RAILWAY_GAME_SERVER_URL = "wss://switchyard.proxy.rlwy.net:19296"

def spawn_game_server(room_id: str):
    """
    Production (Railway) mode:
    - DO NOT spawn multiple game servers
    - Always use the same hosted WebSocket server
    """

    # =====================================================
    # RAILWAY MODE — always use hosted game server
    # =====================================================
    if RAILWAY_GAME_SERVER_URL:
        return {
            "container_id": None,
            "port": None,
            "ws_url": RAILWAY_GAME_SERVER_URL
        }

    # =====================================================
    # LOCAL MODE — this runs ONLY if you're doing localhost dev
    # =====================================================
    port = get_free_port(GAME_SERVER_START_PORT, 5000)

    cmd = [
        "docker", "run", "-d",
        "-p", f"{port}:3000",
        "--name", f"game_server_{room_id}",
        "backend-game-server:latest"
    ]

    try:
        container_id = subprocess.check_output(cmd).decode().strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start game server: {str(e)}")

    return {
        "container_id": container_id,
        "port": port,
        "ws_url": f"ws://localhost:{port}"
    }

# =====================================================
# SESSION / ROOM MANAGEMENT
# =====================================================

def now() -> float:
    return time.time()


def create_session(username: str) -> str:
    sid = str(uuid.uuid4())
    with lock:
        players[sid] = {
            "username": username,
            "last_seen": now(),
            "room_id": None,
            "character": None
        }
    return sid


def create_room_internal(session_id: str, room_name: Optional[str]) -> str:
    if session_id not in players:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    if not room_name:
        room_name = f"Room-{str(uuid.uuid4())[:6]}"

    room_id = str(uuid.uuid4())
    t = now()

    with lock:
        rooms[room_id] = {
            "room_name": room_name,
            "created_at": t,
            "last_seen": t,
            "players": {session_id},
            "characters_taken": set(),
            "state": "waiting",
            "countdown": COUNTDOWN_SECONDS,
            "ws_url": None,
            "server_container": None,
        }
        players[session_id]["room_id"] = room_id

    return room_id


def join_room_internal(session_id: str, room_id: str):
    if session_id not in players:
        raise HTTPException(status_code=400, detail="Invalid session_id")
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room does not exist")

    with lock:
        room = rooms[room_id]

        # ❌ Prevent joining an active running game
        if room["state"] == "running":
            raise HTTPException(status_code=403, detail="Game already started")

        if len(room["players"]) >= MAX_PLAYERS_PER_ROOM:
            raise HTTPException(status_code=403, detail="Room is full")

        prev_room = players[session_id]["room_id"]
        if prev_room and prev_room in rooms:
            rooms[prev_room]["players"].discard(session_id)

        room["players"].add(session_id)
        room["last_seen"] = now()
        players[session_id]["room_id"] = room_id

def choose_character_internal(session_id: str, room_id: str, character: str):
    if session_id not in players:
        raise HTTPException(status_code=400, detail="Invalid session_id")
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room does not exist")

    with lock:
        room = rooms[room_id]

        # character already taken?
        if character in room["characters_taken"]:
            raise HTTPException(status_code=403, detail="Character already taken")

        # remove old character
        old = players[session_id].get("character")
        if old in room["characters_taken"]:
            room["characters_taken"].remove(old)

        # assign new character
        players[session_id]["character"] = character
        room["characters_taken"].add(character)

        # ⭐ NEW BEHAVIOR: start countdown only when first character chosen
        if room["state"] == "waiting":
            room["state"] = "countdown"
            room["countdown"] = COUNTDOWN_SECONDS


# =====================================================
# COUNTDOWN THREAD
# =====================================================

def countdown_loop():
    while True:
        time.sleep(1)

        with lock:
            for room_id, room in list(rooms.items()):

                if room["state"] == "waiting":
                    # As soon as at least one player is in, start countdown
                    if len(room["players"]) >= 1:
                        room["state"] = "countdown"
                        room["countdown"] = COUNTDOWN_SECONDS

                elif room["state"] == "countdown":
                    room["countdown"] -= 1

                    if room["countdown"] <= 0:
                        # Spawn the game server container
                        server_data = spawn_game_server(room_id)
                        room["ws_url"] = server_data["ws_url"]
                        room["server_container"] = server_data

                        # NEW: give server a couple of seconds to boot
                        room["state"] = "starting"
                        room["startup_delay"] = 3  # seconds

                elif room["state"] == "starting":
                    # Count down startup delay
                    room["startup_delay"] -= 1
                    if room["startup_delay"] <= 0:
                        room["state"] = "running"

                elif room["state"] == "running":
                    # In-game; we’ll later add “auto end after 2 min” etc.
                    pass

                elif room["state"] == "ended":
                    del rooms[room_id]


# =====================================================
# CLEANUP THREAD
# =====================================================

def cleanup_loop():
    while True:
        time.sleep(CLEANUP_INTERVAL_SECONDS)
        cutoff = now() - HEARTBEAT_TIMEOUT_SECONDS

        with lock:
            to_delete = []
            for sid, p in players.items():
                if p["last_seen"] < cutoff:
                    rid = p.get("room_id")
                    if rid and rid in rooms:
                        rooms[rid]["players"].discard(sid)
                    to_delete.append(sid)

            for sid in to_delete:
                del players[sid]

            empty_rooms = [rid for rid, r in rooms.items() if len(r["players"]) == 0]
            for rid in empty_rooms:
                del rooms[rid]


# =====================================================
# FASTAPI SETUP
# =====================================================

app = FastAPI(title="Lobby Service 1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def start_threads():
    threading.Thread(target=cleanup_loop, daemon=True).start()
    threading.Thread(target=countdown_loop, daemon=True).start()


# =====================================================
# API ENDPOINTS
# =====================================================

@app.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    sid = create_session(payload.username)
    return LoginResponse(session_id=sid, username=payload.username)


@app.post("/create_room", response_model=CreateRoomResponse)
def create_room(payload: CreateRoomRequest):
    room_id = create_room_internal(payload.session_id, payload.room_name)

    return CreateRoomResponse(
    room_id=room_id,
    room_name=rooms[room_id]["room_name"],
    ws_url=rooms[room_id]["ws_url"] or "",
    session_id=payload.session_id,
)





@app.post("/join_room", response_model=JoinRoomResponse)
def join_room(payload: JoinRoomRequest):
    join_room_internal(payload.session_id, payload.room_id)

    return JoinRoomResponse(
        room_id=payload.room_id,
        room_name=rooms[payload.room_id]["room_name"],
        ws_url=rooms[payload.room_id].get("ws_url") or "",
        session_id=payload.session_id,
    )




@app.post("/choose_character")
def choose_character(req: ChooseCharacterRequest):
    choose_character_internal(req.session_id, req.room_id, req.character)
    return {"status": "selected"}


@app.post("/heartbeat")
def heartbeat(req: HeartbeatRequest):
    if req.session_id in players:
        players[req.session_id]["last_seen"] = now()
    return {"status": "ok"}


@app.get("/rooms", response_model=RoomsResponse)
def list_rooms():
    with lock:
        data = [
           RoomInfo(
    room_id=rid,
    room_name=r["room_name"],
    player_count=len(r["players"]),
    state=r["state"],
    characters_taken=list(r["characters_taken"]),
    ws_url=r["ws_url"],
    countdown=r.get("countdown"),
)

            for rid, r in rooms.items()
        ]
    return RoomsResponse(rooms=data)


@app.get("/")
def root():
    return {"message": "lobby service running"}
