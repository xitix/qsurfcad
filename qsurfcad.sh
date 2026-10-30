#!/usr/bin/env bash
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/backend"
LOG_DIR="$DIR/logs"

BACKEND_PID="$LOG_DIR/backend.pid"
FRONTEND_PID="$LOG_DIR/frontend.pid"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PORT=3001
FRONTEND_PORT=5173
FRONTEND_VITE="$DIR/node_modules/vite/bin/vite.js"

mkdir -p "$LOG_DIR"

msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

is_pid() {
    local pidfile="$1" pid
    [ -f "$pidfile" ] || return 1
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    [ -n "$pid" ] || return 1
    kill -0 "$pid" 2>/dev/null
}

port_open() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

ensure_deps() {
    if ! command -v node >/dev/null 2>&1; then
        msg "[FAIL] Node.js nu este instalat."
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        msg "[FAIL] npm nu este instalat."
        exit 1
    fi

    if [ ! -d "$DIR/node_modules" ]; then
        msg "[SETUP] Instalez dependențele frontend..."
        (cd "$DIR" && npm install) || {
            msg "[FAIL] npm install frontend a eșuat."
            exit 1
        }
    fi

    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        msg "[SETUP] Instalez dependențele backend..."
        (cd "$BACKEND_DIR" && npm install) || {
            msg "[FAIL] npm install backend a eșuat."
            exit 1
        }
    fi

    if [ -f "$BACKEND_DIR/stl2step" ]; then
        chmod +x "$BACKEND_DIR/stl2step" 2>/dev/null || true
    else
        msg "[WARN] $BACKEND_DIR/stl2step lipsește. Conversia STL -> STEP nu va merge."
    fi
}

kill_tree() {
    local pid="$1" sig="$2" children child
    children="$(pgrep -P "$pid" 2>/dev/null || true)"

    for child in $children; do
        kill_tree "$child" "$sig"
    done

    kill "-$sig" "$pid" 2>/dev/null || true
}

start_process() {
    local name="$1" pidfile="$2" logfile="$3" workdir="$4"
    shift 4

    if is_pid "$pidfile"; then
        msg "[OK] $name rulează deja: PID $(cat "$pidfile")."
        return 0
    fi

    msg "[START] $name: $*"

    (
        cd "$workdir" || exit 1
        nohup "$@" >"$logfile" 2>&1 &
        echo $! >"$pidfile"
    )

    sleep 1

    if is_pid "$pidfile"; then
        msg "[OK] $name a pornit: PID $(cat "$pidfile")."
    else
        msg "[FAIL] $name nu a pornit. Verifică logul: $logfile"
        return 1
    fi
}

stop_process() {
    local name="$1" pidfile="$2"
    shift 2
    local patterns=("$@") pid

    if is_pid "$pidfile"; then
        pid="$(cat "$pidfile")"
        msg "[STOP] $name: PID $pid..."

        kill_tree "$pid" TERM

        for _ in $(seq 1 20); do
            if ! kill -0 "$pid" 2>/dev/null; then
                break
            fi
            sleep 0.25
        done

        if kill -0 "$pid" 2>/dev/null; then
            msg "[WARN] $name nu s-a oprit normal. Oprire forțată."
            kill_tree "$pid" KILL
        fi
    else
        msg "[OK] $name nu rulează conform PID file."
    fi

    if [ "${#patterns[@]}" -gt 0 ]; then
        local p
        for p in "${patterns[@]}"; do
            pkill -TERM -f "$p" 2>/dev/null || true
        done

        sleep 1

        for p in "${patterns[@]}"; do
            pkill -KILL -f "$p" 2>/dev/null || true
        done
    fi

    rm -f "$pidfile"
    msg "[OK] $name oprit."
}

start_backend() {
    export STL2STEP_PATH="$BACKEND_DIR/stl2step"

    start_process "Backend" "$BACKEND_PID" "$BACKEND_LOG" "$BACKEND_DIR" \
        node "$BACKEND_DIR/server.js"
}

start_frontend() {
    if [ ! -f "$FRONTEND_VITE" ]; then
        msg "[FAIL] Nu găsesc Vite: $FRONTEND_VITE"
        return 1
    fi

    start_process "Frontend" "$FRONTEND_PID" "$FRONTEND_LOG" "$DIR" \
        node "$FRONTEND_VITE" --port "$FRONTEND_PORT" --strictPort
}

stop_backend() {
    stop_process "Backend" "$BACKEND_PID" "$BACKEND_DIR/server.js"
}

stop_frontend() {
    stop_process "Frontend" "$FRONTEND_PID" \
        "$FRONTEND_VITE" \
        "$DIR/node_modules/.bin/vite"
}

status_process() {
    local name="$1" pidfile="$2" logfile="$3"

    if is_pid "$pidfile"; then
        msg "[RUNNING] $name: PID $(cat "$pidfile") | log: $logfile"
    else
        msg "[STOPPED] $name | log: $logfile"
    fi
}

do_start() {
    ensure_deps

    msg "=== Pornesc QSurfCAD ==="

    start_backend || true
    sleep 1
    start_frontend || true

    msg "Frontend: http://localhost:$FRONTEND_PORT"
    msg "Backend:  http://localhost:$BACKEND_PORT/api/health"
}

do_stop() {
    msg "=== Opresc QSurfCAD ==="
    stop_frontend
    stop_backend
}

do_status() {
    msg "=== Status QSurfCAD ==="

    status_process "Backend" "$BACKEND_PID" "$BACKEND_LOG"
    if port_open "$BACKEND_PORT"; then
        msg "[PORT] Backend ascultă pe portul $BACKEND_PORT."
    else
        msg "[PORT] Backend nu ascultă pe portul $BACKEND_PORT."
    fi

    status_process "Frontend" "$FRONTEND_PID" "$FRONTEND_LOG"
    if port_open "$FRONTEND_PORT"; then
        msg "[PORT] Frontend ascultă pe portul $FRONTEND_PORT."
    else
        msg "[PORT] Frontend nu ascultă pe portul $FRONTEND_PORT."
    fi

    if [ -x "$BACKEND_DIR/stl2step" ]; then
        msg "[OK] stl2step: $BACKEND_DIR/stl2step"
    else
        msg "[WARN] stl2step lipsește sau nu este executabil: $BACKEND_DIR/stl2step"
    fi
}

do_restart() {
    do_stop
    sleep 1
    do_start
}

ACTION="${1:-restart}"

case "$ACTION" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    status)
        do_status
        ;;
    restart)
        do_restart
        ;;
    *)
        echo "Utilizare: $0 {start|stop|status|restart}"
        echo "Fără switch, execută restart."
        exit 1
        ;;
esac