@echo off
SET MODE=both
cd /d C:\Users\Administrator\.qclaw\workspace\knowhow-engine
start /B /WAIT /MIN "" "D:\openclaw\nodejs\node.exe" src/index.js
