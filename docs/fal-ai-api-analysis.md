# Fal.ai API - Kompletna Analiza dla TypeScript

## Spis Treści

1. [Wprowadzenie](#wprowadzenie)
2. [Instalacja i Konfiguracja](#instalacja-i-konfiguracja)
3. [Architektura API](#architektura-api)
4. [TypeScript Client API](#typescript-client-api)
5. [System Kolejek (Queue API)](#system-kolejek-queue-api)
6. [Streaming API](#streaming-api)
7. [Realtime API (WebSocket)](#realtime-api-websocket)
8. [Storage API](#storage-api)
9. [Platform APIs](#platform-apis)
10. [Model Endpoints](#model-endpoints)
11. [Pricing i Billing](#pricing-i-billing)
12. [Przykłady Użycia](#przykłady-użycia)
13. [Best Practices](#best-practices)

---

## Wprowadzenie

Fal.ai to platforma udostępniająca ponad 600 modeli AI do generowania mediów (obrazy, wideo, audio). API zapewnia dostęp przez REST, WebSocket oraz biblioteki klienckie dla JavaScript/TypeScript i Python.

### Główne Cechy

- **600+ modeli AI** - text-to-image, image-to-video, upscaling, editing, audio generation
- **Queue System** - obsługa długotrwałych requestów bez blokowania połączenia
- **Streaming** - częściowe wyniki w czasie rzeczywistym
- **WebSocket/Realtime** - interaktywne aplikacje
- **TypeScript Support** - pełne wsparcie typów
- **Auto-scaling** - automatyczne skalowanie infrastruktury

---

## Instalacja i Konfiguracja

### Instalacja

```bash
npm install --save @fal-ai/client
```

### Podstawowa Konfiguracja

```typescript
import { fal } from "@fal-ai/client";

// Konfiguracja klucza API
fal.config({
  credentials: "YOUR_FAL_API_KEY"
});
```

### Tworzenie Custom Client Instance

```typescript
import { createFalClient } from "@fal-ai/client";

const client = createFalClient({
  credentials: "YOUR_FAL_API_KEY",
  // Opcjonalne: własny proxy endpoint
  proxyUrl: "/api/fal/proxy"
});
```

### Proxy Pattern (Bezpieczeństwo dla Production)

**Zalecane podejście** - ukrycie klucza API przed klientem:

```typescript
// app/api/fal/proxy/route.ts (Next.js)
export { handler as default } from "@fal-ai/server-proxy/nextjs";

// Konfiguracja klienta
fal.config({
  proxyUrl: "/api/fal/proxy"
});
```

### Klucz API

Wygeneruj klucz API na: https://fal.ai/dashboard/keys

---

## Architektura API

Fal.ai udostępnia różne warstwy API:

### 1. Model APIs
Główny interfejs do wywoływania modeli AI.

**Base URLs:**
- Synchroniczny: `https://fal.run/{model_id}`
- Kolejka: `https://queue.fal.run/{model_id}`
- WebSocket: `wss://ws.fal.run/{model_id}`

### 2. Platform APIs
Metadata, billing, analytics.

**Base URL:** `https://api.fal.ai/v1/`

**Endpointy:**
- `GET /models` - wyszukiwanie modeli
- `GET /models/pricing` - cennik
- `POST /models/pricing/estimate` - estymacja kosztów
- `GET /models/usage` - statystyki użycia
- `GET /models/analytics` - analityka

---

## TypeScript Client API

### FalClient Interface

```typescript
interface FalClient {
  // Sub-klienty
  readonly queue: QueueClient;
  readonly realtime: RealtimeClient;
  readonly storage: StorageClient;
  readonly streaming: StreamingClient;

  // Główne metody
  run<Id>(endpointId: Id, options: RunOptions<Input>): Promise<Result<Output>>;
  subscribe<Id>(endpointId: Id, options: RunOptions<Input> & QueueSubscribeOptions): Promise<Result<Output>>;
  stream<Id>(endpointId: Id, options: StreamOptions<Input>): Promise<FalStream<Input, Output>>;
}
```

### 1. run() - Synchroniczne Wywołanie

**⚠️ NIE ZALECANE** dla większości przypadków - blokuje do otrzymania odpowiedzi.

```typescript
const result = await fal.run("fal-ai/flux/dev", {
  input: {
    prompt: "a beautiful sunset over mountains"
  }
});

console.log(result.data.images);
```

**Typ wyniku:**
```typescript
type Result<T> = {
  data: T;
  requestId: string;
};
```

### 2. subscribe() - Queue-based (ZALECANE)

Najlepsza metoda - używa kolejki, nie blokuje, obsługuje długie operacje.

```typescript
const result = await fal.subscribe("fal-ai/flux/dev", {
  input: {
    prompt: "a cat wearing sunglasses"
  },
  // Callback przy dodaniu do kolejki
  onEnqueue: (requestId) => {
    console.log(`Enqueued with ID: ${requestId}`);
  },
  // Callback przy zmianach statusu
  onQueueUpdate: (status) => {
    if (status.status === "IN_QUEUE") {
      console.log(`Queue position: ${status.queue_position}`);
    }
  },
  // Włączenie logów
  logs: true,
  // Timeout w ms
  timeout: 60000,
  // Webhook URL (opcjonalnie)
  webhookUrl: "https://yourapp.com/webhook"
});
```

**Queue Subscribe Options:**
```typescript
type QueueSubscribeOptions = {
  mode?: "polling" | "streaming";  // domyślnie: polling
  pollInterval?: number;             // ms, domyślnie: 500
  connectionMode?: "client" | "server"; // dla streaming
  onEnqueue?: (requestId: string) => void;
  onQueueUpdate?: (status: QueueStatus) => void;
  logs?: boolean;                    // domyślnie: false
  timeout?: number;                  // ms
  webhookUrl?: string;
  priority?: "low" | "normal";       // domyślnie: normal
};
```

### 3. stream() - Streaming Results

Dla modeli wspierających streaming (np. LLM, progressive generation).

```typescript
const stream = await fal.stream("fal-ai/any-llm", {
  input: {
    prompt: "Write a story about...",
    model: "google/gemini-flash-1.5"
  }
});

// Sposób 1: AsyncIterator
for await (const chunk of stream) {
  console.log(chunk);
}

// Sposób 2: Event Listeners
stream.on("data", (chunk) => {
  console.log("Received chunk:", chunk);
});

stream.on("error", (error) => {
  console.error("Stream error:", error);
});

stream.on("done", (finalResult) => {
  console.log("Stream completed:", finalResult);
});

// Czekanie na zakończenie
const finalResult = await stream.done();
```

**FalStream Methods:**
```typescript
class FalStream<Input, Output> {
  on(type: "data" | "error" | "done", listener: EventHandler): void;
  done(): Promise<Output>;
  abort(reason?: string | Error): void;
  [Symbol.asyncIterator](): AsyncGenerator<Output, void, unknown>;

  get signal(): AbortSignal;
  get requestId(): string;
}
```

---

## System Kolejek (Queue API)

Queue API umożliwia asynchroniczne przetwarzanie bez utrzymywania stałego połączenia.

### QueueClient Interface

```typescript
interface QueueClient {
  submit<Id>(endpointId: Id, options: SubmitOptions<Input>): Promise<InQueueQueueStatus>;
  status(endpointId: string, options: QueueStatusOptions): Promise<QueueStatus>;
  streamStatus(endpointId: string, options: QueueStatusStreamOptions): Promise<FalStream<unknown, QueueStatus>>;
  subscribeToStatus(endpointId: string, options: QueueStatusSubscriptionOptions): Promise<CompletedQueueStatus>;
  result<Id>(endpointId: Id, options: BaseQueueOptions): Promise<Result<Output>>;
  cancel(endpointId: string, options: BaseQueueOptions): Promise<void>;
}
```

### 1. Submit Request

```typescript
const queueStatus = await fal.queue.submit("fal-ai/flux/dev", {
  input: {
    prompt: "a cyberpunk cityscape"
  },
  webhookUrl: "https://myapp.com/webhook",
  priority: "normal"
});

console.log(queueStatus.request_id);
console.log(queueStatus.queue_position);
```

**Odpowiedź:**
```typescript
type InQueueQueueStatus = {
  status: "IN_QUEUE";
  request_id: string;
  queue_position: number;
  response_url: string;
  status_url: string;
  cancel_url: string;
};
```

### 2. Check Status

```typescript
const status = await fal.queue.status("fal-ai/flux/dev", {
  requestId: "024ca5b1-45d3-4afd-883e-ad3abe2a1c4d",
  logs: true
});

if (status.status === "IN_QUEUE") {
  console.log(`Position: ${status.queue_position}`);
} else if (status.status === "IN_PROGRESS") {
  console.log("Processing...", status.logs);
} else if (status.status === "COMPLETED") {
  console.log("Done!", status.logs, status.metrics);
}
```

**Queue Status Types:**
```typescript
type QueueStatus = InQueueQueueStatus | InProgressQueueStatus | CompletedQueueStatus;

interface InProgressQueueStatus {
  status: "IN_PROGRESS";
  request_id: string;
  logs: RequestLog[];
  response_url: string;
  status_url: string;
  cancel_url: string;
}

interface CompletedQueueStatus {
  status: "COMPLETED";
  request_id: string;
  logs: RequestLog[];
  metrics?: {
    inference_time: number | null;
  };
  response_url: string;
  status_url: string;
  cancel_url: string;
}

type RequestLog = {
  message: string;
  level: "STDERR" | "STDOUT" | "ERROR" | "INFO" | "WARN" | "DEBUG";
  source: "USER";
  timestamp: string;
};
```

### 3. Stream Status Updates (SSE)

```typescript
const statusStream = await fal.queue.streamStatus("fal-ai/flux/dev", {
  requestId: "...",
  logs: true
});

for await (const status of statusStream) {
  console.log("Status update:", status);
  if (status.status === "COMPLETED") break;
}
```

### 4. Subscribe to Status (Polling lub Streaming)

```typescript
const finalStatus = await fal.queue.subscribeToStatus("fal-ai/flux/dev", {
  requestId: "...",
  mode: "streaming", // lub "polling"
  logs: true,
  onQueueUpdate: (status) => {
    console.log("Update:", status);
  }
});

console.log("Final result:", finalStatus);
```

### 5. Get Result

```typescript
const result = await fal.queue.result("fal-ai/flux/dev", {
  requestId: "..."
});

console.log(result.data);
```

### 6. Cancel Request

```typescript
await fal.queue.cancel("fal-ai/flux/dev", {
  requestId: "..."
});
```

### REST API dla Queue

Możesz też używać bezpośrednio REST API:

**Submit:**
```bash
curl -X POST https://queue.fal.run/fal-ai/flux/dev \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cat"}'
```

**Get Status:**
```bash
curl https://queue.fal.run/fal-ai/flux/dev/requests/{request_id}/status?logs=1 \
  -H "Authorization: Key $FAL_KEY"
```

**Stream Status (SSE):**
```bash
curl https://queue.fal.run/fal-ai/flux/dev/requests/{request_id}/status/stream \
  -H "Authorization: Key $FAL_KEY"
```

**Get Result:**
```bash
curl https://queue.fal.run/fal-ai/flux/dev/requests/{request_id} \
  -H "Authorization: Key $FAL_KEY"
```

**Cancel:**
```bash
curl -X PUT https://queue.fal.run/fal-ai/flux/dev/requests/{request_id}/cancel \
  -H "Authorization: Key $FAL_KEY"
```

---

## Streaming API

### StreamingClient Interface

```typescript
interface StreamingClient {
  stream<Id>(
    endpointId: Id,
    options: StreamOptions<Input>
  ): Promise<FalStream<Input, Output>>;
}
```

### Stream Options

```typescript
type StreamOptions<Input> = {
  readonly url?: string;
  readonly input?: Input;
  readonly queryParams?: Record<string, string>;
  readonly timeout?: number;              // domyślnie: 15000ms
  readonly autoUpload?: boolean;
  readonly method?: "get" | "post" | "put" | "delete";
  readonly accept?: string;               // domyślnie: "text/event-stream"
  readonly connectionMode?: "client" | "server"; // domyślnie: "server"
  readonly signal?: AbortSignal;
};
```

### Przykład - LLM Streaming

```typescript
const stream = await fal.stream("fal-ai/any-llm", {
  input: {
    prompt: "Explain quantum computing",
    model: "google/gemini-flash-1.5"
  },
  timeout: 30000
});

// Async iteration
for await (const token of stream) {
  process.stdout.write(token.text);
}

await stream.done();
```

### Abort Streaming

```typescript
const controller = new AbortController();

const stream = await fal.stream("fal-ai/model", {
  input: { prompt: "..." },
  signal: controller.signal
});

// Później anuluj
controller.abort();
// lub
stream.abort("User cancelled");
```

---

## Realtime API (WebSocket)

Do interaktywnych aplikacji wymagających niskich opóźnień.

### RealtimeClient Interface

```typescript
interface RealtimeClient {
  connect<Input, Output>(
    app: string,
    handler: RealtimeConnectionHandler<Output>
  ): RealtimeConnection<Input>;
}

interface RealtimeConnection<Input> {
  send(input: Input & Partial<{ request_id: string }>): void;
  close(): void;
}
```

### Connection Handler Options

```typescript
interface RealtimeConnectionHandler<Output> {
  connectionKey?: string;           // do reużycia połączenia
  clientOnly?: boolean;             // tylko client-side (SSR)
  throttleInterval?: number;        // domyślnie: 128ms
  maxBuffering?: number;            // 1-60, zalecane: 2
  onResult(result: Output & { request_id: string }): void;
  onError?(error: ApiError<any>): void;
}
```

### Przykład - Realtime Image Generation

```typescript
const connection = fal.realtime.connect("fal-ai/fast-sdxl", {
  throttleInterval: 128,
  onResult: (result) => {
    console.log("New image:", result.images[0].url);
    displayImage(result.images[0].url);
  },
  onError: (error) => {
    console.error("Error:", error);
  }
});

// Wysyłaj zmiany promptu w czasie rzeczywistym
inputElement.addEventListener("input", (e) => {
  connection.send({
    prompt: e.target.value
  });
});

// Zamknij połączenie
connection.close();
```

### React Hook Pattern

```typescript
function useRealtimeGeneration(endpointId: string) {
  const [result, setResult] = useState(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    connectionRef.current = fal.realtime.connect(endpointId, {
      connectionKey: "my-realtime-gen", // reużycie przy re-render
      clientOnly: true,
      onResult: (res) => setResult(res),
      onError: (err) => console.error(err)
    });

    return () => connectionRef.current?.close();
  }, [endpointId]);

  const send = useCallback((input) => {
    connectionRef.current?.send(input);
  }, []);

  return { result, send };
}
```

---

## Storage API

Zarządzanie plikami (upload, transformacja).

### StorageClient Interface

```typescript
interface StorageClient {
  upload(file: Blob, options?: UploadOptions): Promise<string>;
  transformInput(input: Record<string, any>): Promise<Record<string, any>>;
}

interface UploadOptions {
  lifecycle?: ObjectLifecyclePreference;
}

interface ObjectLifecyclePreference {
  expiration_duration_seconds?: number;
  allow_io_storage?: boolean;
}
```

### Upload File

```typescript
import { LIFECYCLE_DURATIONS } from "@fal-ai/client";

const fileUrl = await fal.storage.upload(fileBlob, {
  lifecycle: {
    expiration_duration_seconds: LIFECYCLE_DURATIONS.ONE_WEEK
  }
});

console.log("Uploaded:", fileUrl);
```

**Lifecycle Durations:**
```typescript
const LIFECYCLE_DURATIONS = {
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
  ONE_MONTH: 2592000,
  ONE_YEAR: 31536000,
  UNLIMITED: 31536000000  // ~1000 lat
};
```

### Auto-transform Input

```typescript
const transformedInput = await fal.storage.transformInput({
  prompt: "a dog",
  image: fileBlobOrFile  // automatycznie upload i zamiana na URL
});

// transformedInput.image = "https://fal.media/files/..."
```

---

## Platform APIs

API do metadanych, wyszukiwania modeli, cenników i statystyk.

**Base URL:** `https://api.fal.ai/v1/`

### 1. Models Search API

**Endpoint:** `GET /models`

**Query Parameters:**
```typescript
{
  limit?: number;           // maks. wyników
  cursor?: string;          // paginacja
  endpoint_id?: string | string[]; // konkretne modele (1-50)
  q?: string;              // wyszukiwanie tekstowe
  category?: string;       // np. "text-to-image", "image-to-video"
  status?: "active" | "deprecated";
  expand?: "openapi-3.0" | string[]; // dołącz OpenAPI spec
}
```

**Przykłady:**

```typescript
// Lista wszystkich modeli
const response = await fetch("https://api.fal.ai/v1/models");
const data = await response.json();

// Wyszukiwanie po słowie kluczowym
const response = await fetch(
  "https://api.fal.ai/v1/models?q=text%20to%20image&status=active"
);

// Pobierz konkretne modele
const response = await fetch(
  "https://api.fal.ai/v1/models?endpoint_id=fal-ai/flux/dev&endpoint_id=fal-ai/flux-pro"
);

// Z OpenAPI spec
const response = await fetch(
  "https://api.fal.ai/v1/models?endpoint_id=fal-ai/flux/dev&expand=openapi-3.0"
);
```

**Response:**
```typescript
{
  models: Array<{
    endpoint_id: string;
    metadata: {
      display_name: string;
      category: string;
      description: string;
      status: "active" | "deprecated";
      tags: string[];
      updated_at: string;
      is_favorited: boolean;
      thumbnail_url: string;
      model_url: string;
    };
    openapi?: object; // gdy expand=openapi-3.0
  }>;
  next_cursor: string | null;
  has_more: boolean;
}
```

### 2. Pricing API

**Endpoint:** `GET /models/pricing`

**Query Parameters:**
```typescript
{
  endpoint_id: string | string[]; // wymagane, 1-50 modeli
}
```

**Przykład:**

```bash
curl "https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/flux/dev" \
  -H "Authorization: Key $FAL_KEY"
```

**Response:**
```typescript
{
  prices: Array<{
    endpoint_id: string;
    unit_price: number;
    unit: "image" | "video" | string;
    currency: string; // ISO 4217, np. "USD"
  }>;
  next_cursor: string | null;
  has_more: boolean;
}
```

**Przykład odpowiedzi:**
```json
{
  "prices": [{
    "endpoint_id": "fal-ai/flux/dev",
    "unit_price": 0.025,
    "unit": "image",
    "currency": "USD"
  }]
}
```

### 3. Cost Estimation API

**Endpoint:** `POST /models/pricing/estimate`

**Request Body:**

Dwie metody estymacji:

**A) Historical API Price:**
```typescript
{
  estimate_type: "historical_api_price",
  endpoints: {
    [endpoint_id: string]: {
      call_quantity: number; // min. 1
    }
  }
}
```

**B) Unit Price:**
```typescript
{
  estimate_type: "unit_price",
  endpoints: {
    [endpoint_id: string]: {
      unit_quantity: number; // min. 0.000001
    }
  }
}
```

**Przykład:**

```typescript
const estimate = await fetch("https://api.fal.ai/v1/models/pricing/estimate", {
  method: "POST",
  headers: {
    "Authorization": "Key YOUR_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    estimate_type: "unit_price",
    endpoints: {
      "fal-ai/flux/dev": { unit_quantity: 100 },
      "fal-ai/kling-video/v1.6/standard/image-to-video": { unit_quantity: 10 }
    }
  })
});

const data = await estimate.json();
```

**Response:**
```typescript
{
  estimate_type: "unit_price" | "historical_api_price";
  total_cost: number;
  currency: string;
}
```

### 4. Usage Tracking API

**Endpoint:** `GET /models/usage`

**Query Parameters:**
```typescript
{
  endpoint_id: string | string[]; // wymagane, 1-50
  start?: string;      // ISO8601, domyślnie: -24h
  end?: string;        // ISO8601, domyślnie: now
  timezone?: string;
  limit?: number;
  cursor?: string;
  timeframe?: "minute" | "hour" | "day" | "week" | "month";
  bound_to_timeframe?: boolean; // domyślnie: true
  expand?: "time_series" | "summary" | "auth_method" | string[];
}
```

**Przykład:**

```bash
curl "https://api.fal.ai/v1/models/usage?endpoint_id=fal-ai/flux/dev&start=2025-01-01T00:00:00Z&expand=time_series&expand=summary" \
  -H "Authorization: Key $ADMIN_API_KEY"
```

**Response:**
```typescript
{
  time_series?: Array<{
    bucket: string; // timestamp
    results: Array<{
      endpoint_id: string;
      unit: string;
      quantity: number;
      unit_price: number;
      auth_method?: string;
    }>;
  }>;
  summary?: {
    // agregaty
  };
  next_cursor: string | null;
  has_more: boolean;
}
```

---

## Model Endpoints

### Popularne Modele

#### 1. FLUX.1 [dev] - Text-to-Image

**Endpoint:** `fal-ai/flux/dev`

**Opis:** 12B parametrów, szybka generacja obrazów wysokiej jakości.

**Input:**
```typescript
{
  prompt: string;                    // wymagane
  num_images?: number;               // 1-4, domyślnie: 1
  image_size?:
    | "square_hd" | "square"
    | "portrait_4_3" | "portrait_16_9"
    | "landscape_4_3" | "landscape_16_9"
    | { width: number, height: number };
  num_inference_steps?: number;      // 1-50, domyślnie: 28
  guidance_scale?: number;           // 1-20, domyślnie: 3.5
  seed?: number;
  output_format?: "jpeg" | "png";    // domyślnie: jpeg
  acceleration?: "none" | "regular" | "high";
  enable_safety_checker?: boolean;   // domyślnie: true
  sync_mode?: boolean;               // domyślnie: false
}
```

**Output:**
```typescript
{
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  seed: number;
  has_nsfw_concepts: boolean[];
  timings: object;
  prompt: string;
}
```

**Pricing:** $0.025 per megapixel (zaokrąglenie w górę)

**Przykład:**
```typescript
const result = await fal.subscribe("fal-ai/flux/dev", {
  input: {
    prompt: "a majestic lion in the savanna, golden hour, photorealistic",
    image_size: "landscape_16_9",
    num_inference_steps: 28,
    guidance_scale: 3.5
  },
  logs: true,
  onQueueUpdate: (update) => {
    console.log(update);
  }
});

console.log(result.data.images[0].url);
```

#### 2. Kling Video 1.6 - Image-to-Video

**Endpoint:** `fal-ai/kling-video/v1.6/standard/image-to-video`

**Opis:** Konwersja obrazu na video z animacją według promptu.

**Input:**
```typescript
{
  prompt: string;              // wymagane, max 2500 znaków
  image_url: string;           // wymagane
  duration?: "5" | "10";       // domyślnie: "5"
  negative_prompt?: string;    // domyślnie: "blur, distort, and low quality"
  cfg_scale?: number;          // 0-1, domyślnie: 0.5
}
```

**Output:**
```typescript
{
  video: {
    url: string; // MP4
  }
}
```

**Pricing:** $0.045 per second (5s = $0.225, 10s = $0.45)

**Czas przetwarzania:** ~6 minut

**Przykład:**
```typescript
// Upload obrazu
const imageUrl = await fal.storage.upload(imageFile);

// Generuj video
const result = await fal.subscribe("fal-ai/kling-video/v1.6/standard/image-to-video", {
  input: {
    prompt: "The person smiles and waves at the camera",
    image_url: imageUrl,
    duration: "10",
    cfg_scale: 0.5
  },
  onQueueUpdate: (status) => {
    if (status.status === "IN_QUEUE") {
      console.log(`Position in queue: ${status.queue_position}`);
    }
  }
});

console.log("Video URL:", result.data.video.url);
```

#### 3. Inne Popularne Modele

**Text-to-Image:**
- `fal-ai/flux/schnell` - ultra szybki (1-4 kroki)
- `fal-ai/flux-pro/v1.1-ultra` - 2K, profesjonalna jakość
- `fal-ai/recraft-v3` - Recraft V3
- `fal-ai/imagen-4` - Google Imagen 4

**Text-to-Video:**
- `fal-ai/veo-3.1` - Google Veo 3.1
- `fal-ai/wan-2.5-image-to-video` - z audio
- `fal-ai/sana-video` - Sana Video

**Video Upscaling:**
- `fal-ai/flash-vsr` - FlashVSR
- `fal-ai/bytedance-video-upscaler`
- `fal-ai/simalabs-video-upscaler-lite`

**Image Upscaling:**
- `fal-ai/crystal-upscaler` - dla portretów
- `fal-ai/flux-vision-upscaler`

**Audio:**
- `fal-ai/chatterbox-tts` - Text-to-Speech
- `fal-ai/minimax-speech-02`
- `fal-ai/beatoven` - generowanie muzyki/SFX

---

## Pricing i Billing

### Modele Rozliczeń

1. **Output-based** - większość modeli
   - Image: za obraz lub megapixel
   - Video: za sekundę wideo

2. **GPU-based** - niektóre modele
   - Za jednostkę czasu GPU

### Przykładowe Ceny

| Model | Cena | Jednostka |
|-------|------|-----------|
| FLUX.1 [dev] | $0.025 | per megapixel |
| FLUX.1 [schnell] | tańszy | per image |
| Kling Video 1.6 | $0.045 | per second |
| Veo 3.1 | varies | per video |

### Estymacja Kosztów

```typescript
// Estymacja przed wywołaniem
async function estimateCost(endpoint: string, expectedUnits: number) {
  const response = await fetch("https://api.fal.ai/v1/models/pricing/estimate", {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      estimate_type: "unit_price",
      endpoints: {
        [endpoint]: { unit_quantity: expectedUnits }
      }
    })
  });

  const data = await response.json();
  return data.total_cost;
}

// Użycie
const cost = await estimateCost("fal-ai/flux/dev", 10); // 10 obrazów
console.log(`Estimated cost: $${cost}`);
```

### Monitorowanie Użycia

```typescript
async function getUsageStats(endpoint: string, days: number = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const params = new URLSearchParams({
    endpoint_id: endpoint,
    start: start.toISOString(),
    end: end.toISOString(),
    timeframe: "day",
    expand: "time_series,summary"
  });

  const response = await fetch(
    `https://api.fal.ai/v1/models/usage?${params}`,
    {
      headers: {
        "Authorization": `Key ${ADMIN_API_KEY}`
      }
    }
  );

  return await response.json();
}
```

---

## Przykłady Użycia

### 1. Prosty Generator Obrazów

```typescript
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

async function generateImage(prompt: string) {
  try {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size: "landscape_16_9",
        num_inference_steps: 28
      },
      onQueueUpdate: (update) => {
        if (update.status === "IN_QUEUE") {
          console.log(`Queue position: ${update.queue_position}`);
        }
      }
    });

    return result.data.images[0].url;
  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
}

// Użycie
const imageUrl = await generateImage("a sunset over ocean");
console.log(imageUrl);
```

### 2. Batch Generation z Progress Tracking

```typescript
async function generateBatch(prompts: string[]) {
  const requests = prompts.map(async (prompt, index) => {
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: { prompt },
      onQueueUpdate: (update) => {
        console.log(`[${index}] Status:`, update.status);
      }
    });
    return result.data.images[0].url;
  });

  return await Promise.all(requests);
}

const urls = await generateBatch([
  "a cat",
  "a dog",
  "a bird"
]);
```

### 3. Image-to-Video Pipeline

```typescript
async function imageToVideo(imageFile: File, animationPrompt: string) {
  console.log("Uploading image...");
  const imageUrl = await fal.storage.upload(imageFile, {
    lifecycle: { expiration_duration_seconds: 604800 } // 7 days
  });

  console.log("Generating video...");
  const result = await fal.subscribe(
    "fal-ai/kling-video/v1.6/standard/image-to-video",
    {
      input: {
        image_url: imageUrl,
        prompt: animationPrompt,
        duration: "10"
      },
      onQueueUpdate: (status) => {
        if (status.status === "IN_PROGRESS") {
          console.log("Processing video...");
        }
      },
      timeout: 600000 // 10 minut
    }
  );

  return result.data.video.url;
}

// Użycie
const videoUrl = await imageToVideo(
  myImageFile,
  "The person starts dancing"
);
```

### 4. Streaming Text Generation

```typescript
async function generateText(prompt: string) {
  const stream = await fal.stream("fal-ai/any-llm", {
    input: {
      model: "google/gemini-flash-1.5",
      prompt
    }
  });

  let fullText = "";

  for await (const chunk of stream) {
    fullText += chunk.text;
    process.stdout.write(chunk.text);
  }

  return fullText;
}

const text = await generateText("Explain TypeScript generics");
```

### 5. Realtime Canvas Drawing

```typescript
function setupRealtimeGeneration(canvas: HTMLCanvasElement) {
  let currentPrompt = "";

  const connection = fal.realtime.connect("fal-ai/fast-sdxl", {
    throttleInterval: 300,
    onResult: (result) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = result.images[0].url;
    },
    onError: (error) => {
      console.error("Generation error:", error);
    }
  });

  // Input handler
  const input = document.getElementById("prompt-input") as HTMLInputElement;
  input.addEventListener("input", (e) => {
    currentPrompt = (e.target as HTMLInputElement).value;
    connection.send({
      prompt: currentPrompt,
      num_inference_steps: 4
    });
  });

  return () => connection.close();
}
```

### 6. Webhook Handler (Next.js)

```typescript
// app/api/webhooks/fal/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { WebHookResponse } from "@fal-ai/client";

export async function POST(request: NextRequest) {
  const webhook: WebHookResponse = await request.json();

  if (webhook.status === "OK") {
    // Przetwórz sukces
    console.log("Request completed:", webhook.request_id);
    console.log("Result:", webhook.payload);

    // Zapisz do bazy, wyślij email, etc.
    await saveResult(webhook.request_id, webhook.payload);

    return NextResponse.json({ received: true });
  } else {
    // Obsłuż błąd
    console.error("Request failed:", webhook.error);
    await logError(webhook.request_id, webhook.error);

    return NextResponse.json({ received: true, error: webhook.error });
  }
}

async function saveResult(requestId: string, payload: any) {
  // Implementacja zapisu
}

async function logError(requestId: string, error: string) {
  // Implementacja logowania
}
```

### 7. Error Handling i Retry

```typescript
import { ApiError, ValidationError, isRetryableError } from "@fal-ai/client";

async function generateWithRetry(
  prompt: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fal.subscribe("fal-ai/flux/dev", {
        input: { prompt },
        timeout: 120000
      });

      return result.data.images[0].url;

    } catch (error) {
      lastError = error as Error;

      if (error instanceof ValidationError) {
        console.error("Validation error:", error.errors);
        throw error; // Nie retry przy walidacji
      }

      if (error instanceof ApiError) {
        console.error(`API error (${error.status}):`, error.message);

        if (!isRetryableError(error)) {
          throw error; // Nie retry przy błędach nieodwracalnych
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // exponential backoff
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### 8. Multiple Models Pipeline

```typescript
async function enhanceImage(inputImage: File) {
  // 1. Upload
  const imageUrl = await fal.storage.upload(inputImage);

  // 2. Upscale
  const upscaleResult = await fal.subscribe("fal-ai/crystal-upscaler", {
    input: { image_url: imageUrl }
  });

  // 3. Dalsze przetwarzanie
  const enhancedUrl = upscaleResult.data.image.url;

  // 4. Convert to video
  const videoResult = await fal.subscribe(
    "fal-ai/kling-video/v1.6/standard/image-to-video",
    {
      input: {
        image_url: enhancedUrl,
        prompt: "slowly zoom in, cinematic",
        duration: "5"
      }
    }
  );

  return {
    original: imageUrl,
    upscaled: enhancedUrl,
    video: videoResult.data.video.url
  };
}
```

---

## Best Practices

### 1. Zawsze używaj Queue (`subscribe`)

```typescript
// ❌ Źle - blokuje, ryzyko timeout
const result = await fal.run("fal-ai/flux/dev", { input });

// ✅ Dobrze - asynchroniczne, niezawodne
const result = await fal.subscribe("fal-ai/flux/dev", {
  input,
  onQueueUpdate: (status) => console.log(status)
});
```

### 2. Używaj Proxy w Production

```typescript
// ❌ Źle - klucz API w przeglądarce
fal.config({ credentials: "fal-xyz-123..." });

// ✅ Dobrze - klucz na serwerze
// server/api/fal/proxy/route.ts
export { handler as default } from "@fal-ai/server-proxy/nextjs";

// client
fal.config({ proxyUrl: "/api/fal/proxy" });
```

### 3. Upload plików przez Storage API

```typescript
// ✅ Auto-upload z lifecycle
const imageUrl = await fal.storage.upload(file, {
  lifecycle: {
    expiration_duration_seconds: LIFECYCLE_DURATIONS.ONE_WEEK
  }
});
```

### 4. Obsługuj wszystkie Queue States

```typescript
fal.subscribe("fal-ai/model", {
  input,
  onEnqueue: (requestId) => {
    console.log("Enqueued:", requestId);
    // Zapisz requestId do późniejszego odpytania
  },
  onQueueUpdate: (status) => {
    switch (status.status) {
      case "IN_QUEUE":
        updateUI({ position: status.queue_position });
        break;
      case "IN_PROGRESS":
        updateUI({ state: "processing", logs: status.logs });
        break;
      case "COMPLETED":
        updateUI({ state: "done", logs: status.logs });
        break;
    }
  }
});
```

### 5. Implementuj Proper Error Handling

```typescript
import { ApiError, ValidationError, isRetryableError } from "@fal-ai/client";

try {
  const result = await fal.subscribe(...);
} catch (error) {
  if (error instanceof ValidationError) {
    // Pokaż błędy walidacji użytkownikowi
    showValidationErrors(error.errors);
  } else if (error instanceof ApiError) {
    if (error.status === 429) {
      // Rate limit
      showError("Too many requests. Please wait.");
    } else if (isRetryableError(error)) {
      // Retry
      retryRequest();
    } else {
      showError(error.message);
    }
  } else {
    // Network error, etc.
    showError("Network error. Please check your connection.");
  }
}
```

### 6. Używaj Webhooks dla Long-running Tasks

```typescript
// Submit z webhookiem
const status = await fal.queue.submit("fal-ai/slow-model", {
  input,
  webhookUrl: "https://myapp.com/api/webhooks/fal"
});

// Zapisz request_id w DB
await db.requests.create({
  id: status.request_id,
  status: "pending"
});

// Webhook handler odbierze wynik
```

### 7. Optymalizuj Koszty

```typescript
// Estymuj koszty przed wywołaniem
const estimate = await estimateCost(endpoint, expectedUnits);
if (estimate > BUDGET_LIMIT) {
  throw new Error("Budget exceeded");
}

// Używaj szybszych/tańszych modeli gdzie możliwe
const model = highQuality
  ? "fal-ai/flux/dev"      // wolniejszy, droższy
  : "fal-ai/flux/schnell"; // szybszy, tańszy
```

### 8. Throttle Realtime Connections

```typescript
// ✅ Dobrze - throttle 128ms
const connection = fal.realtime.connect("fal-ai/fast-sdxl", {
  throttleInterval: 128,
  maxBuffering: 2,
  onResult: (result) => updateUI(result)
});
```

### 9. Cleanup Resources

```typescript
// Realtime
const connection = fal.realtime.connect(...);
// ... use connection ...
connection.close(); // Zawsze zamykaj

// Streaming
const stream = await fal.stream(...);
// ... use stream ...
stream.abort(); // Anuluj jeśli już niepotrzebny

// AbortController
const controller = new AbortController();
fal.subscribe("...", {
  input,
  abortSignal: controller.signal
});
// Later: controller.abort();
```

### 10. Type Safety

```typescript
// Definiuj typy input/output
type FluxInput = {
  prompt: string;
  image_size?: string;
  num_inference_steps?: number;
};

type FluxOutput = {
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  seed: number;
};

// Użyj z generic types
const result = await fal.subscribe<FluxOutput>("fal-ai/flux/dev", {
  input: {
    prompt: "a cat"
  } as FluxInput
});

// result.data jest typu FluxOutput
console.log(result.data.images[0].url);
```

---

## Podsumowanie

### Główne Metody API

| Metoda | Use Case | Zalecane? |
|--------|----------|-----------|
| `fal.run()` | Synchroniczne, szybkie modele | ❌ Nie |
| `fal.subscribe()` | Większość przypadków, queue | ✅ Tak |
| `fal.stream()` | Streaming (LLM, progressive) | ✅ Tak |
| `fal.realtime.connect()` | Interaktywne, low-latency | ✅ Tak (specyficzne) |
| `fal.queue.*` | Manualny queue management | 🟡 Rzadko |

### Queue Modes

- **Polling** (domyślnie): sprawdza status co 500ms
- **Streaming**: Server-Sent Events, real-time updates

### Kluczowe Koncepty

1. **Zawsze używaj kolejek** dla niezawodności
2. **Proxy dla bezpieczeństwa** w production
3. **Webhooks dla długich zadań** (>2 min)
4. **Storage API dla plików** z lifecycle management
5. **Error handling** - sprawdzaj `ValidationError`, `ApiError`
6. **Monitoring kosztów** - używaj Platform APIs

### Przydatne Linki

- Dokumentacja: https://docs.fal.ai
- Modele: https://fal.ai/models
- Dashboard: https://fal.ai/dashboard
- GitHub: https://github.com/fal-ai/fal-js
- NPM: https://www.npmjs.com/package/@fal-ai/client

---

**Data utworzenia:** 2025-11-11
**Wersja biblioteki:** @fal-ai/client (latest)
**Status:** Kompletna analiza API
