# Monolith Example (Part A)

Минимальный монолит по OpenAPI‑подходу для выполнения ДЗ_1 (Часть A)

Что тут есть:
- Простое API на Node.js/Express
- Сквозной 'x-request-id' (принимается и генерируется, возвращается в ответе)
- Регистрация пользователя - выдаём demo‑токен (bearer token)
- Диалоги: отправка сообщения и получение списка сообщений с пользователем
- In‑memory хранилище

Быстрый старт

Docker Compose:

$ docker compose up --build
# сервис доступен на http://localhost:8080

## Пример сценария (curl)
1) Регистрируем двух пользователей и получаем токены:

$ curl -sX POST http://localhost:8080/user/register -H 'Content-Type: application/json' -d '{"name":"Alice"}'
# => { "user": {"id":1,"name":"Alice"}, "token":"demo-..." }

$ curl -sX POST http://localhost:8080/user/register -H 'Content-Type: application/json' -d '{"name":"Bob"}'
# => { "user": {"id":2,"name":"Bob"}, "token":"demo-..." }

Сохраняем токены в переменные:

$ export T1="demo-...ALICE..."
$ export T2="demo-...BOB..."


2) Пусть Alice пишет Bob:

$ curl -sX POST http://localhost:8080/dialog/2/send   -H "Authorization: Bearer $T1"   -H "x-request-id: hello-1"   -H "Content-Type: application/json"   -d '{"text":"Привет, Боб!"}'

3) Bob отвечает Alice:

$ curl -s "http://localhost:8080/dialog/1/list" -H "Authorization: Bearer $T2"
# смотрим id сообщения и отвечаем

$ curl -sX POST http://localhost:8080/dialog/1/send   -H "Authorization: Bearer $T2"   -H "Content-Type: application/json"   -d '{"text":"Привет! Как дела?","reply_to":1}'

4) Alice читает диалог:

curl -s "http://localhost:8080/dialog/2/list?limit=100" -H "Authorization: Bearer $T1"


Что поменяется в Части Б (подготовка)^
- Эндпоинты '/dialog/*' в этом монолите превратятся в legacy‑фасад (proxy) к новому 'chat-service'
- Логику хранения сообщений перенесём в отдельный сервис
- Сквозной 'x-request-id' останется - его будет принимать монолит и пробрасывать в новый сервис

Эндпоинты^
- 'GET /health
- 'POST /user/register' - '{ user, token }'
- 'GET /user/get/:id' - 'user'
- 'POST /dialog/:user_id/send' (Bearer) - создаёт сообщение '{id, from, to, text, reply_to, ts}'
- 'GET /dialog/:user_id/list' (Bearer) - '{ total, items: [...] }'

Postman:
Коллекция: 'postman/Monolith.postman_collection.json'

