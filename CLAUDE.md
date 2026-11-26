# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Отвечай пользователю на русском.

## Язык в коде

- **В коде нет русского текста.** Комментарии, XML-doc, сообщения логов и исключений, тексты ProblemDetails, имена и описания тестов, комментарии в Dockerfile/compose/CI — на английском.
- **Тексты интерфейса — только в файлах локали** (`web/src/i18n/ru.json`), в коде — по ключу: `t.nav.lessons`. Тесты тоже берут строки из `t`, а не пишут их литералами.
- Русский допустим в документации (`*.md`), в учебном контенте (`content/`) и в промптах агентов/Claude.
- Польский в коде — только как данные (название приложения «Mów po polsku!», примеры в тестах).

## Статус проекта

Есть каркас: API с health/version/OpenAPI/логами/трассировкой, React-клиент с роутингом и заглушками разделов, Docker, compose, CI. Фич волны 1 пока нет. Дизайн согласован в макетах (Artifact «Polish App — направления дизайна», страница «Раунд 4 · Mów po polsku!»). Пометка «план» — то, чего в коде ещё нет; при реализации убирай её.

## Команды

```powershell
# Разработка: два процесса (или preview «api» и «web» из .claude/launch.json)
dotnet run --project src/Api          # API на http://127.0.0.1:5080, Scalar: /scalar
npm run dev --prefix web              # клиент на http://127.0.0.1:5173, /api и /health проксируются на 5080

# Бэкенд
dotnet build
dotnet test                           # xUnit v3 на Microsoft.Testing.Platform (см. global.json)
dotnet test --project tests/Api.Tests -- --filter-method "*Version*"   # один тест

# Клиент (из web/)
npm run lint                          # oxlint
npm test                              # vitest run
npx vitest run src/app/AppLayout.test.tsx -t "недоступен"             # один тест
npm run build

# Собранное приложение + Aspire Dashboard
docker compose up --build             # приложение: http://127.0.0.1:8480 (APP_PORT), дашборд: http://127.0.0.1:18888
```

Порт 8080 на машине автора занят другим проектом — поэтому compose публикует 8480.

## Что это

Локальное веб-приложение для изучения польского языка, интерфейс на русском, уровень **A1–A2**. Разделы: **Уроки**, **Задания**, **Шпаргалка**, **Мои ошибки**. Приложение обращается к локальному **Claude CLI** пользователя (месячная подписка, API-ключа нет). Цель проекта для автора — практика .NET-бэкенда и инфраструктуры (Docker, CI/CD).

## Стек

- **Backend:** ASP.NET Core **.NET 10 (LTS)** Minimal API, организация по фичам (`Features/<Фича>/<Фича>Endpoints.cs` с extension-методом `Map…Endpoints`). ProblemDetails, OpenAPI + Scalar (только Development), Serilog, OpenTelemetry (OTLP включается переменной `OTEL_EXPORTER_OTLP_ENDPOINT`). FluentValidation — план. Слушает только `127.0.0.1`.
  - Пакеты — централизованно в `Directory.Packages.props`. `Microsoft.AspNetCore.*` держим на 10.x: версии 11.x требуют net11.0.
  - `Directory.Build.props`: `TreatWarningsAsErrors`, анализаторы `latest-recommended`.
  - Неизвестный `/api/*` отдаёт 404 ProblemDetails; остальные пути — `index.html` клиента (SPA fallback).
- **Frontend:** React 19 + Vite + TypeScript, Tailwind v4 (токены дизайна в `web/src/index.css` → `@theme`), React Router, TanStack Query, oxlint, Vitest + Testing Library. Генерация TS-клиента и Zod-схем из OpenAPI (Orval) — план; пока `web/src/shared/api/` пишется вручную.
- **Хранилище:**
  - Пользовательское состояние (прогресс, ошибки, результаты сессий, позже — интервальное повторение) — **на клиенте** (IndexedDB), с экспортом/импортом JSON. Сервер пользовательских данных не хранит.
  - На сервере — только то, что не относится к пользователю: кэш ответов Claude и сгенерированные задания (PostgreSQL + EF Core, план).
- **Тесты:** xUnit v3 + WebApplicationFactory (есть); Testcontainers, Playwright — план.
- **Инфраструктура:**
  - `Dockerfile` — три стадии: node собирает `web/dist` → sdk публикует API, кладя клиент в `wwwroot` → aspnet-рантайм, пользователь `$APP_UID`.
  - `compose.yaml` — api + Aspire Dashboard; Postgres добавится вместе с первой фичей, которой он нужен.
  - `.github/workflows/ci.yml` — jobs `api`, `web`, `image`; образ публикуется в GHCR только при push в main.
  - Dependabot — nuget, npm, actions, docker. release-please — план.

## Архитектура

```
content/              уроки, шпаргалки, банк заданий (план)
src/Api/
  Features/AppInfo/   GET /api/version
  Infrastructure/     логи, трассировка, health (/health/live, /health/ready)
tests/Api.Tests/      интеграционные тесты API
web/src/
  app/                роутер и общий layout (шапка с разделами)
  pages/              страницы разделов (пока заглушки)
  shared/api/         запросы к API через TanStack Query
```

- **Браузер никогда не вызывает Claude напрямую.** CLI запускает только сервер, вся работа с ним — в одном модуле (`IClaudeClient` / `ClaudeCliClient`, фейк для CI).
- **Задания — discriminated union по `type`** (`fill-gap`, `multiple-choice`, `declension-table`, `translation`, `find-error`). Новый формат = ветка схемы + рендерер на клиенте + (опционально) промпт генерации. Статические и сгенерированные задания проходят одну валидацию.
- **Проверка ответов:** закрытые форматы — детерминированно, без Claude. Claude — для свободных ответов (перевод) и разбора ошибок. Ответ Claude — JSON по схеме; невалидный ответ = ошибка, а не показ «как есть».
- **Контент грузится из файлов при старте**, не из БД.

## Набор фич

**Волна 1 (MVP):** уроки из Markdown; шпаргалка с поиском формы и печатью A4; задания закрытого типа; сессия из 10 заданий с итогом; разбор Claude (объяснение ошибки, проверка перевода, «Объясни подробнее» потоком); «Мои ошибки».

**Волна 2:** интервальное повторение (FSRS); фоновая генерация заданий Claude с кэшем; «Спросить Claude» о форме слова; озвучка через Web Speech API (pl-PL); статистика.

**Волна 3:** личный словарь, ролевые диалоги с Claude, разбор вставленного текста, деплой на VPS с аутентификацией.

## Claude CLI

- Вызов: `claude -p --output-format json --json-schema "<schema>" --system-prompt ... --tools "" --model haiku --no-session-persistence`, промпт — через stdin. Для потока: `--output-format stream-json --verbose --include-partial-messages` → SSE (`TypedResults.ServerSentEvents`). Схемы — из C#-записей через `JsonSchemaExporter`.
- Запуск в пустом временном каталоге, без инструментов и MCP; `SemaphoreSlim` на число параллельных вызовов, `CancellationToken` с таймаутом, `Process.Kill(entireProcessTree: true)`.
- **Не задавай `ANTHROPIC_API_KEY`** — иначе CLI перейдёт на оплату по API. `--bare` не использовать (игнорирует OAuth). В Docker — `CLAUDE_CODE_OAUTH_TOKEN` из `claude setup-token` через `.env`.
- Windows: запускай `claude.exe` по полному пути, а не `claude.cmd`.
- Health check — `claude --version`.

## Контент

- Уроки пишет Claude; **каждый новый или изменённый файл в `content/` проверяет агент `polish-content-reviewer`** (`.claude/agents/`) до коммита. Правки по его отчёту — до вердикта «можно публиковать».
- Польский с диакритикой (ą ć ę ł ń ó ś ź ż), все файлы в UTF-8. Пояснения на русском, примеры на польском с переводом.
- Тенденции не подаются как правила; в примерах нет непройденных форм без пометки.

## Дизайн

«Польский плакат × журнал» по `style_doc.txt`, адаптированный:
- Цвета: бумага `#F4EFE6`, поверхность `#EBE4D8`, чернила `#181818`, приглушённый `#57534E`, вермильон `#D9381E` (мелкий текст и плашки — `#B42C16`), кобальт `#1D4ED8` (окончания), охра `#D97706` (только декор).
- Шрифты: Oswald (заголовки, капс), Lora (текст; у Newsreader нет кириллицы), Caveat — только редкие пометки и не для польских форм, Archivo Black — только цифры/латиница.
- Нулевые скругления, тени только жёсткие (`4px 4px 0 #181818`).
- Раскладка: слева навигация (кнопка выхода + содержание/список заданий), справа одна колонка для чтения (≈880px). Разделы нумерованы, пометки «↳» приглушённые и внутри своих разделов. Шпаргалки — в один столбец, рядом только связанные для сравнения.
- Компактно: H1 36px, H2 20px, кнопки 42px (навигация 44px), отступ между разделами 48px. Обратная связь по заданию — на месте, в карточке.
- Доступность: видимый `:focus-visible`, `<del>/<ins>` для исправлений, `role="status"` для вердикта, цвет не единственный носитель смысла. До 768px левая колонка сворачивается.
