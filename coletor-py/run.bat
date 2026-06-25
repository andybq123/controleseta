@echo off
cd /d "%~dp0"
if not exist .venv (
    echo Criando ambiente virtual...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
    python -m playwright install chromium
) else (
    call .venv\Scripts\activate
)
python coletor.py
pause