@echo off

node --enable-source-maps --no-warnings=ExperimentalWarning "%~dp0\run.js" %*
