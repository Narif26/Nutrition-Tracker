# NutriChat

NutriChat is a full-stack nutrition tracker built around a chatbot-style main flow. You describe what you ate in plain English, and the app logs structured entries, looks up nutrition data, recomputes daily totals, and refreshes a live dashboard without a page reload.

## What It Does

- Logs foods from chat messages such as `2 eggs and 1 slice of toast`
- Handles edit and remove commands such as `Remove the toast`, `Delete lunch`, `Change 2 eggs to 3 eggs`, and `Undo last item`
- Uses an OpenAI-backed command interpreter for chat actions, with controlled web search for branded or restaurant queries and backend markdown prompt logs for inspection
- Tracks calories, protein, carbs, and fat in the live dashboard
- Shows live daily progress, remaining calories, a calorie history chart, and a chronological meal log
- Renders 7, 14, and 30 day calorie charts
- Generates personalized goals from age, sex, height, weight, activity level, and primary goal
- Preserves nutrition source metadata so each logged item can be inspected
- Resets the active dashboard automatically at the viewer's local midnight and refreshes when the tab regains focus

## Stack

- Next.js 16 + TypeScript
- App Router + API routes
- PostgreSQL + Prisma
- Tailwind CSS
- shadcn-style UI primitives
- Recharts
- OpenAI Responses API for structured chat command interpretation and controlled web search
- Simple demo auth structure with a seeded local user

## Data Sources

- USDA FoodData Central is the primary nutrition lookup source when `USDA_API_KEY` is configured
- Open Food Facts is used for barcode-style queries
- A curated fallback food library is included so the app still works locally without an API key for common demo foods

No scraping is used.

## Core Flows

### Add food

Examples:

- `2 eggs and 1 slice of toast`
- `1 banana`
- `Chipotle chicken bowl with white rice and black beans`

NutriChat sends the current day log, current totals, goals, tracked metrics, and recent chat context to an OpenAI model. The model returns a structured action plan, and the server then performs the actual nutrition lookup and recomputation. If OpenAI is not configured or the request fails, the app returns an error and does not mutate the dashboard state. Each OpenAI request is also written to backend markdown trace files so you can inspect the exact system prompt, payload, request body, response or error, and whether web search was enabled.

For branded, restaurant, packaged, or likely current-product queries, NutriChat can expose OpenAI web search in a controlled way. Generic foods, remove/undo commands, and nutrition calculations do not rely on web browsing. USDA/Open Food Facts and the app database remain the source of truth for actual nutrition totals.

### Edit food

Examples:

- `Change 2 eggs to 3 eggs`
- `Edit chicken from 4 oz to 6 oz`

Edits soft-delete the previous entry, create a replacement entry, and recompute the day summary.

### Remove food

Examples:

- `Remove banana`
- `Delete lunch`
- `Undo last item`

Deletes are soft deletes, so history is preserved for auditability while active totals stay correct.

## Project Structure

```text
prisma/
  schema.prisma
  seed.ts
src/
  app/
    api/
      chat/route.ts
      snapshot/route.ts
      settings/route.ts
    error.tsx
    globals.css
    layout.tsx
    loading.tsx
    page.tsx
  components/
    chat/
    dashboard/
    settings/
    ui/
    nutrichat-app.tsx
  lib/
    ai/
    auth.ts
    date.ts
    db.ts
    goals.ts
    parser/
    nutrition/
    services/
    validations/
  types/
```

## Database Models

- `User`
- `UserProfile`
- `NutritionGoal`
- `FoodEntry`
- `EntrySourceMetadata`
- `DailySummary`
- `ChatMessage`

`FoodEntry` rows keep the active nutrient snapshot that was used at log time. `DailySummary` rows are recomputed after every add, edit, remove, and undo so the chart and dashboard stay fast.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and update values as needed.

```powershell
Copy-Item .env.example .env
```

Required:

- `DATABASE_URL`

Optional:

- `USDA_API_KEY`
- `DEMO_USER_EMAIL`
- `DEFAULT_TIME_ZONE`
- `OPEN_FOOD_FACTS_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_WEB_SEARCH_MODE`
- `OPENAI_WEB_SEARCH_CONTEXT_SIZE`
- `OPENAI_WEB_SEARCH_COUNTRY`
- `OPENAI_WEB_SEARCH_ALLOWED_DOMAINS`

### 3. Start PostgreSQL

Using Docker:

```bash
docker compose up -d db
```

### 4. Push the Prisma schema

```bash
npm run db:push
```

### 5. Reset the local demo user

```bash
npm run db:seed
```

The seed script clears any existing demo food entries and chat history so the app starts with an empty log.

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To use the chat parser, add your OpenAI API key to `.env`:

```env
OPENAI_API_KEY="your-key-here"
OPENAI_MODEL="gpt-5.2"
OPENAI_WEB_SEARCH_MODE="controlled"
```

The UI shows the configured OpenAI model when chat is ready, and `<model> required` when `OPENAI_API_KEY` is missing.

Web search modes:

- `controlled`: only expose web search on likely branded, restaurant, packaged, or current-product queries
- `always`: allow web search on every parser request
- `off`: disable web search entirely

You can optionally restrict web search to specific domains:

```env
OPENAI_WEB_SEARCH_ALLOWED_DOMAINS="chipotle.com,starbucks.com,world.openfoodfacts.org"
```

Prompt trace markdown files are written to:

- `logs/llm-prompts/latest.md`
- `logs/llm-prompts/YYYY-MM-DD/*.md`

If you see `OpenAI parser request failed (429)` or an `OpenAI quota exceeded` error, the request payload that caused it will be captured in that directory as long as the OpenAI call reached the parser layer.

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:push
npm run db:seed
```

## Goal Generation

Personalized calorie and macro goals are generated from:

- age
- sex
- height
- weight
- activity level
- goal type

The app uses a Mifflin-St Jeor style calorie estimate, goal-based calorie adjustments, and weight-scaled protein targets. Micronutrient defaults come from standard daily values, and any field can be manually overridden in settings.

## Notes on Accuracy

- USDA lookups prefer structured food matches and store match metadata
- Branded and barcode flows are source-labeled in the UI
- If USDA is unavailable or no good match is found, NutriChat falls back to a curated local catalog for common foods
- The OpenAI model never acts as the nutrition source of truth; it only interprets user intent into structured actions
- Daily totals, micronutrients, and chart values are always recomputed server-side from saved entries after every add, edit, remove, or undo
- Local-midnight rollover is handled from the browser timezone so a long-running session resets to a fresh daily dashboard without a manual reload

## Verification

The repository currently passes:

- `npm run lint`
- `npm run build`

## Known MVP Tradeoffs

- LLM parsing depends on an OpenAI API key, network access, and available OpenAI quota; if any of those are unavailable, chat requests return an error without changing the log
- Ambiguous foods are logged with visible source metadata rather than hidden behind silent assumptions
- Auth is mock/demo oriented, but the code is structured so a real auth layer can replace `ensureDemoUser`

## Next Steps

- Replace demo auth with a real provider
- Add explicit follow-up disambiguation prompts in chat
- Add favorites, barcode scan UI, exports, and adherence insights
- Add tool-assisted restaurant/menu disambiguation for branded meals
