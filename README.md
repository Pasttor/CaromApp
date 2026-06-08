# Billiard VAR Scoreboard

MVP local para clubes de billar con marcador digital, control de tiempo de mesa y sistema VAR/replay basado en buffer circular.

## Estructura

- `frontend/`: React + Vite + TypeScript.
- `backend/`: FastAPI + SQLite + servicio de video FFmpeg/HLS.
- `data/`: base local, videos temporales y logs generados en runtime.

## Desarrollo

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

La UI queda en `http://127.0.0.1:5173`.

## Video

El backend busca FFmpeg en este orden:

1. Variable `FFMPEG_PATH`.
2. `ffmpeg` en el `PATH`.
3. Binario de `imageio-ffmpeg`, si está instalado.

Si FFmpeg no está disponible, el marcador sigue funcionando y la UI muestra el estado de error del módulo VAR.

