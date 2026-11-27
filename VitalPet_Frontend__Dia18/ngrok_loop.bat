@echo off
title ngrok VitalPet
:inicio
ngrok http --url=cortex-timothy-stainless.ngrok-free.dev 5173
echo Se cerro el tunel, reconectando...
timeout /t 2 >nul
goto inicio