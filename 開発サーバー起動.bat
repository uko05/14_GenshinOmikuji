@echo off
:: E:\20_GitHub\ を起点にサーバーを起動することで
:: /99_SharedImage/... のパスが正しく解決される
cd /d "%~dp0.."
echo サーバー起動中... http://localhost:5500/14_GenshinOmikuji/
npx http-server -p 5500 --cors -c-1 -o 14_GenshinOmikuji/index.html
pause
