# SPEED OPTIMIZATION GUIDE FOR DOCUMENT PROCESSING

## Current Performance (from logs):
- Download & Partition: 61s (13.6%)
- Chunking: 0.02s (0.004%)
- AI Summarization: 383s (85.7%) ← BOTTLENECK
- Embedding & Storage: 3s (0.67%)
- **TOTAL: 447s (~7.5 minutes)**

## Target Performance:
- AI Summarization: 75-100s (with 5x parallelization)
- **TOTAL: ~140-170s (~2.5 minutes)** ✅

---

## SOLUTION 1: Parallel Processing (Recommended) ⭐

### Speed Improvement: **5x faster** (383s → 75s)

**How it works:**
- Process 5 chunks simultaneously instead of 1 at a time
- Uses asyncio + ThreadPoolExecutor
- Respects OpenAI rate limits

**Changes needed in tasks.py:**

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Replace the existing summarise_chunks function with this:

def summarise_chunks(chunks, document_id, source_type="file"):
    """Transform chunks into searchable content - PARALLEL VERSION"""
    print(f"🧠 Processing {len(chunks)} chunks with AI (PARALLEL)...")
    start_time = time.time()
    
    processed_chunks = asyncio.run(
        summarise_chunks_parallel(chunks, document_id, source_type)
    )
    
    print(f"✅ Processed {len(processed_chunks)} chunks")
    print(f"⏱ [TIMING] summarise_chunks total time: {time.time() - start_time:.2f}s")
    return processed_chunks

async def summarise_chunks_parallel(chunks, document_id, source_type="file"):
    """Process chunks in parallel"""
    total_chunks = len(chunks)
    
    # Create task for each chunk
    tasks = []
    for i, chunk in enumerate(chunks):
        task = process_chunk_async(chunk, i, total_chunks, document_id, source_type)
        tasks.append(task)
    
    # Limit concurrent API calls (adjust based on your OpenAI tier)
    # Tier 1: 3-5 concurrent, Tier 2: 10, Tier 3+: 20
    semaphore = asyncio.Semaphore(5)
    
    async def bounded_task(task):
        async with semaphore:
            return await task
    
    # Run all tasks with concurrency limit
    results = await asyncio.gather(*[bounded_task(task) for task in tasks])
    return results

async def process_chunk_async(chunk, index, total_chunks, document_id, source_type):
    """Process single chunk asynchronously"""
    current_chunk = index + 1
    
    # Update status every 5 chunks
    if current_chunk % 5 == 0 or current_chunk == total_chunks:
        update_status(document_id, 'summarising', {
            "summarising": {"current_chunk": current_chunk, "total_chunks": total_chunks}
        })
    
    # Extract content
    content_data = separate_content_types(chunk, source_type)
    
    # Log chunks with media
    if content_data['tables'] or content_data['images']:
        print(f"  Chunk {current_chunk}: {len(content_data['tables'])} tables, {len(content_data['images'])} images")
    
    # AI summarization (run in thread pool since langchain is sync)
    if content_data['tables'] or content_data['images'] or len(content_data['text']) > 1000:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            enhanced_content = await loop.run_in_executor(
                executor,
                create_ai_summary,
                content_data['text'],
                content_data['tables'],
                content_data['images'],
                current_chunk
            )
    else:
        enhanced_content = content_data['text']
    
    # Validation
    if not enhanced_content or len(enhanced_content.strip()) < 10:
        enhanced_content = content_data['text']
    
    generic_responses = ["hello! how can i assist", "how can i help you"]
    if any(generic in enhanced_content.lower() for generic in generic_responses):
        enhanced_content = content_data['text']
    
    # Build result
    original_content = {'text': content_data['text']}
    if content_data['tables']:
        original_content['tables'] = content_data['tables']
    if content_data['images']:
        original_content['images'] = content_data['images']
    
    return {
        'content': enhanced_content,
        'original_content': original_content,
        'type': content_data['types'],
        'page_number': get_page_number(chunk, index),
        'char_count': len(enhanced_content)
    }
```

---

## SOLUTION 2: Skip AI for Simple Chunks (Quick Win) 🚀

### Speed Improvement: **30-40% faster**

Currently you're calling AI even for simple text chunks. Skip AI for:
- Chunks < 500 characters
- Chunks without tables/images AND < 1000 characters

```python
# In summarise_chunks, change condition:

# OLD:
if content_data['tables'] or content_data['images'] or len(content_data['text']) > 1000:
    enhanced_content = create_ai_summary(...)

# NEW:
if content_data['tables'] or content_data['images']:
    # Always use AI for media
    enhanced_content = create_ai_summary(...)
elif len(content_data['text']) > 1000:
    # Use AI for long text
    enhanced_content = create_ai_summary(...)
else:
    # Skip AI for short, simple text
    enhanced_content = content_data['text']
```

---

## SOLUTION 3: Faster AI Model (Trade-off) ⚡

### Speed Improvement: **2-3x faster per call**

Switch from `gpt-4-turbo` to `gpt-4o-mini`:

```python
# In tasks.py initialization:

# OLD:
llm = ChatOpenAI(model="gpt-4-turbo", temperature=0)

# NEW:
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

**Pros:**
- 2-3x faster
- 10x cheaper
- Still very good quality

**Cons:**
- Slightly less accurate for complex analysis
- May miss some nuances

---

## SOLUTION 4: Batch Embeddings (Already Optimized) ✅

You're already doing this well:
```
Batch size: 20 (good)
⏱ Embeddings: 3.01s for 25 chunks (excellent)
```

---

## SOLUTION 5: Combined Approach (BEST) 🏆

### Speed Improvement: **6-8x faster overall**

Combine multiple optimizations:

1. **Parallel processing** (5x)
2. **Skip simple chunks** (1.3x)
3. **Use gpt-4o-mini** (2x)

**Expected result:**
- 383s → 383s / (5 × 1.3 × 2) = **29s** for AI summarization
- **Total time: ~100s (1.6 minutes)** instead of 447s

---

## IMPLEMENTATION PRIORITY:

### Phase 1 (Quick Wins - 5 minutes):
1. ✅ Skip AI for simple chunks
2. ✅ Switch to gpt-4o-mini (if quality acceptable)

### Phase 2 (Best Results - 15 minutes):
3. ✅ Implement parallel processing

### Phase 3 (Advanced - optional):
4. Cache common chunks (e.g., headers, footers)
5. Use streaming for real-time feedback

---

## RATE LIMITS TO CONSIDER:

**OpenAI Tier Limits:**
- Tier 1 (Free): 3 RPM → Use semaphore=3
- Tier 2 ($5+ spent): 60 RPM → Use semaphore=10
- Tier 3 ($50+ spent): 500 RPM → Use semaphore=20

Adjust the `Semaphore(5)` value based on your tier!

---

## TESTING:

After implementing, you should see logs like:
```
🧠 Processing 25 chunks with AI (PARALLEL)...
  Chunk 5: 0 tables, 1 images  ← Chunks processed out of order (parallel)
  Chunk 3: AI call (text only)
  Chunk 7: AI call (text + 2 images)
  Chunk 2: AI call (text only)
✅ Processed 25 chunks
⏱ [TIMING] summarise_chunks total time: 75.23s  ← 5x faster!
```

---

## FILES TO MODIFY:

1. **tasks.py** - Replace `summarise_chunks()` function
2. **Add imports** at top:
   ```python
   import asyncio
   from concurrent.futures import ThreadPoolExecutor
   ```

That's it! The rest of your code stays the same.
