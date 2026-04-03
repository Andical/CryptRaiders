@echo off
echo Iniciando servidor local para el juego...
cd C:\DiscordGame\Godot-Client\Export
python -m http.server 8000
pause
