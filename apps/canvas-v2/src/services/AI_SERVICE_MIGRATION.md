# AI Service Migration Guide

এই project এ দুইটা AI service option আছে:

## 1. Gemini API (বর্তমান)

ফাইল: `services/gemini.ts`

- Google এর Gemini 2.5 Flash model ব্যবহার করে
- Retry logic সহ
- Streaming support

## 2. OpenAI API (নতুন)

ফাইল: `services/openai.ts`

- OpenAI এর GPT-4 Mini/GPT-4O model ব্যবহার করে
- Same retry logic
- Same streaming support
- Vision support (image-to-component)

---

## OpenAI তে Switch করার পদ্ধতি:

### Step 1: Environment Variable

আপনার project root এ `.env.local` file তৈরি করুন (বা existing `.env` edit করুন):

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

### Step 2: Import পরিবর্তন

যেসব ফাইলে `gemini.ts` import করা আছে, সেগুলো `openai.ts` এ পরিবর্তন করুন:

#### Before:

```typescript
import { optimizeLayoutStream, generateCopyStream } from "../services/gemini";
```

#### After:

```typescript
import { optimizeLayoutStream, generateCopyStream } from "../services/openai";
```

### Step 3: Model Selection (Optional)

`services/openai.ts` file এ model পরিবর্তন করতে পারবেন:

```typescript
// Line 8
const DEFAULT_MODEL = "gpt-4o-mini"; // Fast & Cheap
// অথবা
const DEFAULT_MODEL = "gpt-4o"; // Better Quality
```

---

## Migration Files List

নিচের ফাইলগুলোতে import update করতে হবে:

1. ✅ **Canvas.tsx** - AI Panel এর জন্য
2. ✅ **StylePanel.tsx** - AI Agent এর জন্য
3. ✅ **EditorLayout.tsx** - Landing page optimizer
4. অন্যান্য যেকোনো ফাইল যা `generateComponent`, `editComponent` ইত্যাদি ব্যবহার করে

---

## API Cost Comparison

| Feature            | Gemini 2.5 Flash | GPT-4o Mini | GPT-4O     |
| ------------------ | ---------------- | ----------- | ---------- |
| Input (1M tokens)  | Free (limited)   | $0.15       | $2.50      |
| Output (1M tokens) | Free (limited)   | $0.60       | $10.00     |
| Speed              | ⚡⚡⚡           | ⚡⚡        | ⚡         |
| Quality            | ⭐⭐⭐⭐         | ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐ |
| Vision Support     | ✅               | ❌          | ✅         |

---

## Recommendation

- **Development/Testing**: Gemini (free tier)
- **Production (Budget)**: GPT-4o Mini
- **Production (Quality)**: GPT-4O
- **Image Features**: GPT-4O or Gemini

---

## Original Gemini আবার ফিরে যেতে চাইলে:

শুধু import গুলো আবার `gemini.ts` এ পরিবর্তন করুন। দুটো file ই project এ রাখতে পারবেন।
