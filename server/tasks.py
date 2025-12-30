from celery import Celery
from database import BUCKET_NAME, s3_client, supabase
import time
from unstructured.partition.pdf import partition_pdf
from unstructured.partition.docx import partition_docx
from unstructured.partition.html import partition_html
from unstructured.partition.pptx import partition_pptx
from unstructured.partition.text import partition_text
from unstructured.partition.md import partition_md
from unstructured.partition.csv import partition_csv
from unstructured.chunking.title import chunk_by_title
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage
import os
from scrapingbee import ScrapingBeeClient
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor


# Initialize ScrapingBee client
scrapingbee_client = ScrapingBeeClient(api_key=os.getenv('SCRAPINGBEE_API_KEY'))

# Initialize LLM for summarization
llm = ChatOpenAI(model="gpt-4-turbo", temperature=0)

# Initialize embeddings model
embeddings_model = OpenAIEmbeddings(
    model="text-embedding-3-large",
    dimensions=1536
)

# Create Celery app
celery_app = Celery(
    'document_processor',
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

def update_status(document_id: str, status: str, details: dict = None):
    """Update document processing status with optional details"""
    result = supabase.table("project_documents").select("processing_details").eq("id", document_id).execute()
    current_details = {}
    if result.data and result.data[0]["processing_details"]:
        current_details = result.data[0]["processing_details"]
    if details:
        current_details.update(details)
    supabase.table("project_documents").update({
        "processing_status": status,
        "processing_details": current_details,
    }).eq("id", document_id).execute()

@celery_app.task
def process_document(document_id: str):
    """Real document Processing"""
    print(f"📄 Starting processing for document: {document_id}")
    try:
        total_start = time.time()
        
        # Get document details
        doc_result = supabase.table("project_documents").select("*").eq("id", document_id).execute()
        if not doc_result.data:
            raise Exception(f"Document {document_id} not found")
        
        document = doc_result.data[0]
        
        # Determine source_type based on what's present (don't trust source_type field)
        if document.get("source_url") and document.get("source_url").strip():
            source_type = "url"
        elif document.get("s3_key") and document.get("s3_key").strip():
            source_type = "file"
        else:
            raise Exception("Document has neither source_url nor s3_key")
        
        print(f"📋 Source type: {source_type}")

        # Step 1: Download and partition
        step_start = time.time()
        update_status(document_id, "partitioning")
        elements = download_and_partition(document_id, document)
        print(f"⏱ [TIMING] download_and_partition took {time.time() - step_start:.2f}s")
        
        # Count elements
        tables = sum(1 for e in elements if getattr(e, 'category', '') == "Table")
        images = sum(1 for e in elements if getattr(e, 'category', '') == "Image")
        text_elements = sum(1 for e in elements if getattr(e, 'category', '') in ["NarrativeText", "Title", "Text"])
        print(f"📊 Extracted: {tables} tables, {images} images, {text_elements} text elements")

        # Step 2: Chunk elements
        step_start = time.time()
        chunks, chunking_metrics = chunk_elements_by_title(elements, source_type)
        print(f"⏱ [TIMING] chunk_elements_by_title took {time.time() - step_start:.2f}s")
        update_status(document_id, "summarizing", {"chunking": chunking_metrics})
        print(f"✅ Created {chunking_metrics['total_chunks']} chunks")

        # Step 3: Summarize chunks
        step_start = time.time()
        processed_chunks = summarise_chunks(chunks, document_id, source_type)
        print(f"⏱ [TIMING] summarise_chunks took {time.time() - step_start:.2f}s")

        # Step 4: Vectorization & storing
        step_start = time.time()
        update_status(document_id, 'vectorization')
        stored_chunk_ids = store_chunks_with_embeddings(document_id, processed_chunks)
        print(f"⏱ [TIMING] store_chunks_with_embeddings took {time.time() - step_start:.2f}s")

        # Step 5: Mark as completed
        update_status(document_id, 'completed')
        print(f"✅ Processing completed for {document_id} ({len(stored_chunk_ids)} chunks)")
        print(f"⏱ [TIMING] Total time: {time.time() - total_start:.2f}s")

        return {"status": "success", "document_id": document_id}

    except Exception as e:
        print(f"❌ ERROR processing document {document_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        update_status(document_id, 'failed', {'error': str(e)})
        return {"status": "error", "error": str(e)}

def download_and_partition(document_id: str, document: dict):
    """Download document from S3 or crawl URL and partition into elements"""
    start_time = time.time()
    elements = []
    temp_file = None

    try:
        # AUTO-DETECT source type based on what fields are present
        source_url = document.get("source_url")
        s3_key = document.get("s3_key")
        
        # Determine actual source type (don't trust source_type field alone)
        if source_url and source_url.strip():
            # This is a URL document
            source_type = "url"
            url = source_url.strip()
            
            print(f"🌐 Scraping URL: {url}")
            
            # Fetch content with ScrapingBee (with JS rendering for dynamic sites)
            response = scrapingbee_client.get(
                url,
                params={
                    "render_js": "true",  # Enable JavaScript rendering
                    "wait": 2000,  # Wait 2 seconds for page to load
                    "block_resources": "false"  # Allow all resources
                }
            )
            
            print(f"✅ Scraped {len(response.content)} bytes from {url}")
            
            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.html', mode='wb')
            temp_file.write(response.content)
            temp_file.close()
            
            # Partition HTML
            elements = partition_document(temp_file.name, "html", source_type="url")
            
            # Log what was extracted
            num_elements = len(elements)
            element_types = {}
            for el in elements:
                el_type = type(el).__name__
                element_types[el_type] = element_types.get(el_type, 0) + 1
            print(f"📑 Extracted from URL: {num_elements} elements - {element_types}")

        elif s3_key and s3_key.strip():
            # This is a file document
            source_type = "file"
            filename = document.get("filename", "")
            
            file_type = filename.split(".")[-1].lower() if filename else "pdf"
            print(f"📂 Downloading file: {filename} (type: {file_type})")
            
            # Download from S3 to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}')
            temp_file.close()
            
            s3_client.download_file(BUCKET_NAME, s3_key, temp_file.name)
            print(f"✅ Downloaded from S3 to {temp_file.name}")
            
            # Partition document
            elements = partition_document(temp_file.name, file_type, source_type="file")
            
            # Log what was extracted
            num_tables = sum(1 for el in elements if type(el).__name__ == 'Table')
            num_images = sum(1 for el in elements if type(el).__name__ == 'Image')
            num_texts = sum(1 for el in elements if type(el).__name__ in ['NarrativeText', 'Text', 'Title'])
            print(f"📑 Extracted from file: {num_tables} tables, {num_images} images, {num_texts} text elements")
        
        else:
            # Neither URL nor file - invalid document
            raise Exception(
                f"Invalid document: no source_url or s3_key found. "
                f"Document data: source_url={source_url}, s3_key={s3_key}"
            )

        # Analyze and update status
        elements_summary = analyze_elements(elements)
        update_status(document_id, "chunking", {
            "partitioning": {
                "elements_found": elements_summary,
                "total_elements": len(elements)
            }
        })

    finally:
        # Clean up temp file
        if temp_file and hasattr(temp_file, 'name') and os.path.exists(temp_file.name):
            os.remove(temp_file.name)
        elif temp_file and isinstance(temp_file, str) and os.path.exists(temp_file):
            os.remove(temp_file)

    print(f"⏱ [TIMING] download_and_partition total time: {time.time() - start_time:.2f}s")
    return elements

def partition_document(temp_file: str, file_type: str, source_type: str = "file"):
    """Partition document based on file type and source type"""
    
    if source_type == "url":
        print(f"🔍 Partitioning HTML from URL...")
        return partition_html(
            filename=temp_file,
            # URL-specific settings
            include_metadata=True
        )
    
    if file_type == "pdf":
        print(f"🔍 Partitioning PDF with hi-res strategy...")
        return partition_pdf(
            filename=temp_file,
            strategy="hi_res",  # High-quality extraction
            infer_table_structure=True,  # Extract tables as HTML
            ocr_languages=["eng"],
            ocr_strategy="auto",
            extract_image_block_types=["Image"],
            extract_image_block_to_payload=True,  # Get base64 images
            include_metadata=True
        )
    
    if file_type in ["docx", "doc"]:
        print(f"🔍 Partitioning Word document...")
        return partition_docx(
            filename=temp_file,
            strategy="hi_res",
            infer_table_structure=True,
            include_metadata=True
        )
    
    if file_type in ["pptx", "ppt"]:
        print(f"🔍 Partitioning PowerPoint document...")
        return partition_pptx(
            filename=temp_file,
            strategy="hi_res",
            infer_table_structure=True,
            include_metadata=True
        )
    
    if file_type in ["txt", "text"]:
        print(f"🔍 Partitioning plain text document...")
        return partition_text(
            filename=temp_file,
            include_metadata=True
        )
    
    if file_type in ["md", "markdown"]:
        print(f"🔍 Partitioning Markdown document...")
        return partition_md(
            filename=temp_file,
            include_metadata=True
        )
    
    if file_type == "csv":
        print(f"🔍 Partitioning CSV document...")
        return partition_csv(
            filename=temp_file,
            strategy="hi_res",  # High-quality extraction
            infer_table_structure=True,  # Extract tables as HTML
            ocr_languages=["eng"],
            ocr_strategy="auto",
            extract_image_block_types=["Image"],
            extract_image_block_to_payload=True,  # Get base64 images
            include_metadata=True
        )

    # Fallback to HTML for other types
    print(f"🔍 Partitioning as HTML (fallback for {file_type})...")
    return partition_html(filename=temp_file)

def analyze_elements(elements):
    """Count different types of elements found"""
    text_count = 0
    table_count = 0
    image_count = 0
    title_count = 0
    other_count = 0

    for element in elements:
        element_name = type(element).__name__
        if element_name == "Table":
            table_count += 1
        elif element_name == "Image":
            image_count += 1
        elif element_name in ["Title", "Header"]:
            title_count += 1
        elif element_name in ["NarrativeText", "Text", "ListItem", "FigureCaption"]:
            text_count += 1
        else:
            other_count += 1

    return {
        "text": text_count,
        "tables": table_count,
        "images": image_count,
        "titles": title_count,
        "other": other_count
    }

def chunk_elements_by_title(elements, source_type="file"):
    """Chunk elements using title-based strategy with smart element mapping"""
    print("🔨 Creating smart chunks...")
    start_time = time.time()

    if not elements:
        print("⚠ No elements to chunk")
        return [], {"total_chunks": 0}

    # Store elements for later reference
    elements_list = list(elements)

    # Create chunks
    chunks = chunk_by_title(
        elements,
        max_characters=3000,
        new_after_n_chars=2400,
        combine_text_under_n_chars=500
    )

    print(f"📦 Mapping elements to {len(chunks)} chunks...")
    total_tables_mapped = 0
    total_images_mapped = 0

    for chunk_idx, chunk in enumerate(chunks):
        # Initialize metadata
        if not hasattr(chunk, 'metadata'):
            from types import SimpleNamespace
            chunk.metadata = SimpleNamespace()

        original_elements = []

        # METHOD 1: Try using orig_elements from unstructured
        if hasattr(chunk.metadata, 'orig_elements'):
            try:
                orig_elements_data = chunk.metadata.orig_elements
                if orig_elements_data and isinstance(orig_elements_data, list):
                    original_elements = [e for e in orig_elements_data if hasattr(e, 'text')]
                    if original_elements:
                        print(f"  Chunk {chunk_idx+1}: Used metadata ({len(original_elements)} elements)")
            except Exception:
                pass

        # METHOD 2: Fallback to smart text+position matching
        if not original_elements:
            chunk_text = chunk.text if hasattr(chunk, 'text') else str(chunk)

            for element in elements_list:
                element_text = element.text if hasattr(element, 'text') else str(element)
                element_type = type(element).__name__

                matched = False

                # Special handling for Tables and Images
                if element_type in ["Table", "Image"]:
                    # Strategy A: Text-based matching
                    if element_text and len(element_text) > 5:
                        words = [w for w in element_text.split() if len(w) > 3]
                        if words:
                            matches = sum(1 for word in words if word in chunk_text)
                            match_ratio = matches / len(words) if len(words) > 0 else 0
                            if match_ratio > 0.3:  # 30% overlap
                                matched = True

                    # Strategy B: Position-based matching (for images with no text)
                    if not matched and source_type == "file":  # Only for files
                        elem_idx = elements_list.index(element)
                        elements_per_chunk = len(elements_list) / len(chunks)
                        chunk_start_idx = int(chunk_idx * elements_per_chunk)
                        chunk_end_idx = int((chunk_idx + 1) * elements_per_chunk)

                        if chunk_start_idx <= elem_idx < chunk_end_idx:
                            matched = True
                else:
                    # Regular text elements - exact matching
                    if element_text and element_text in chunk_text:
                        matched = True

                if matched:
                    original_elements.append(element)

        # Remove duplicates
        seen = set()
        unique_elements = []
        for elem in original_elements:
            elem_id = id(elem)
            if elem_id not in seen:
                seen.add(elem_id)
                unique_elements.append(elem)

        chunk.metadata.original_elements = unique_elements

        # Count and log
        tables_in_chunk = sum(1 for e in unique_elements if type(e).__name__ == "Table")
        images_in_chunk = sum(1 for e in unique_elements if type(e).__name__ == "Image")

        total_tables_mapped += tables_in_chunk
        total_images_mapped += images_in_chunk

        if tables_in_chunk > 0 or images_in_chunk > 0:
            print(f"  Chunk {chunk_idx+1}: {tables_in_chunk} tables, {images_in_chunk} images")

    # Verification
    original_tables = sum(1 for e in elements_list if type(e).__name__ == "Table")
    original_images = sum(1 for e in elements_list if type(e).__name__ == "Image")

    print(f"✓ Element mapping complete:")
    print(f"  Tables: {total_tables_mapped}/{original_tables} mapped")
    print(f"  Images: {total_images_mapped}/{original_images} mapped")

    if total_tables_mapped < original_tables:
        print(f"  ⚠ WARNING: {original_tables - total_tables_mapped} tables not mapped!")
    if total_images_mapped < original_images:
        print(f"  ⚠ WARNING: {original_images - total_images_mapped} images not mapped!")

    print(f"⏱ [TIMING] chunk_elements_by_title total time: {time.time() - start_time:.2f}s")
    return chunks, {"total_chunks": len(chunks)}

# def summarise_chunks(chunks, document_id, source_type="file"):
#     """Transform chunks into searchable content with AI summaries"""
#     print(f"🧠 Processing {len(chunks)} chunks with AI...")
#     start_time = time.time()

#     processed_chunks = []
#     total_chunks = len(chunks)
#     status_update_interval = 5  # Update status every 5 chunks

#     for i, chunk in enumerate(chunks):
#         current_chunk = i + 1

#         # Update status periodically
#         if current_chunk % status_update_interval == 0 or current_chunk == total_chunks:
#             update_status(document_id, 'summarising', {
#                 "summarising": {
#                     "current_chunk": current_chunk,
#                     "total_chunks": total_chunks
#                 }
#             })

#         # Extract content
#         content_data = separate_content_types(chunk, source_type)

#         # Log only chunks with tables/images
#         if content_data['tables'] or content_data['images']:
#             print(f"  Chunk {current_chunk}: {len(content_data['tables'])} tables, {len(content_data['images'])} images")

#         # Decide if AI summary is needed
#         if content_data['tables'] or content_data['images'] or len(content_data['text']) > 1000:
#             enhanced_content = create_ai_summary(
#                 content_data['text'],
#                 content_data['tables'],
#                 content_data['images'],
#                 chunk_index=current_chunk
#             )
#         else:
#             enhanced_content = content_data['text']

#         # Validation
#         if not enhanced_content or len(enhanced_content.strip()) < 10:
#             enhanced_content = content_data['text']

#         # Check for generic responses
#         generic_responses = ["hello! how can i assist", "how can i help you", "what can i do for you"]
#         if any(generic in enhanced_content.lower() for generic in generic_responses):
#             print(f"  ⚠ Detected generic response, using original text")
#             enhanced_content = content_data['text']

#         # Build original_content
#         original_content = {'text': content_data['text']}
#         if content_data['tables']:
#             original_content['tables'] = content_data['tables']
#         if content_data['images']:
#             original_content['images'] = content_data['images']

#         # Create processed chunk
#         processed_chunk = {
#             'content': enhanced_content,
#             'original_content': original_content,
#             'type': content_data['types'],
#             'page_number': get_page_number(chunk, i),
#             'char_count': len(enhanced_content)
#         }

#         processed_chunks.append(processed_chunk)

#     print(f"✅ Processed {len(processed_chunks)} chunks")
#     print(f"⏱ [TIMING] summarise_chunks total time: {time.time() - start_time:.2f}s")
#     return processed_chunks





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




def get_page_number(chunk, chunk_index):
    """Get page number from chunk or use fallback"""
    if hasattr(chunk, 'metadata'):
        page_number = getattr(chunk.metadata, 'page_number', None)
        if page_number is not None:
            return page_number
    return chunk_index + 1

def separate_content_types(chunk, source_type="file"):
    """Analyze what types of content are in a chunk"""
    is_url_source = source_type == 'url'

    content_data = {
        'text': chunk.text,
        'tables': [],
        'images': [],
        'types': ['text']
    }

    # Check for tables and images in original elements
    if hasattr(chunk, 'metadata') and hasattr(chunk.metadata, 'original_elements'):
        images_skipped = 0
        
        for element in chunk.metadata.original_elements:
            element_type = type(element).__name__

            # Handle tables
            if element_type == 'Table':
                if 'table' not in content_data['types']:
                    content_data['types'].append('table')
                
                # Try multiple attribute names for table HTML
                table_html = None
                if hasattr(element, 'metadata'):
                    table_html = (
                        getattr(element.metadata, 'text_as_html', None) or
                        getattr(element.metadata, 'text-as-html', None) or
                        getattr(element.metadata, 'html', None)
                    )
                if not table_html:
                    table_html = element.text
                
                content_data['tables'].append(table_html)

            # Handle images
            elif element_type == 'Image':
                # For URL sources, images don't have base64 data (just HTML references)
                # So we skip them for now - they're already in the text content
                if is_url_source:
                    images_skipped += 1
                    continue
                
                # For file sources (PDFs), extract base64 images
                if (hasattr(element, 'metadata') and
                    hasattr(element.metadata, 'image_base64') and
                    element.metadata.image_base64 is not None):
                    
                    if 'image' not in content_data['types']:
                        content_data['types'].append('image')
                    content_data['images'].append(element.metadata.image_base64)
        
        # Log if images were skipped for URL sources
        if images_skipped > 0 and is_url_source:
            print(f"      ℹ Skipped {images_skipped} images from URL (no base64 data available)")

    return content_data


def create_ai_summary(text, tables_html, images_base64, chunk_index=0):
    """Create AI-enhanced summary for mixed content"""
    try:
        # Validate input
        if not text or len(text.strip()) < 10:
            return text

        # Clean text
        cleaned_text = clean_text_for_ai(text)

        # Build prompt
        prompt_text = f"""You are analyzing a section from a document. Create a structured, searchable summary.

DOCUMENT SECTION:
{cleaned_text}
"""

        # Add tables if present
        if tables_html:
            prompt_text += "\nTABLES (HTML format):\n"
            for i, table in enumerate(tables_html):
                prompt_text += f"Table {i+1}:\n{table}\n\n"

        # Add instructions
        prompt_text += """
TASK:
Create a comprehensive search index in the following EXACT format:

SEARCH INDEX:

KEY QUESTIONS:
- What [question about main topic]?
- How [question about process/method]?
- Why [question about reasoning]?
- When [question about timing/sequence]?
- Who [question about people/entities]?

KEYWORDS:
- Numbers: [all specific numbers, dates, percentages]
- Technical Terms: [all technical concepts]
- Named Entities: [names, organizations, locations]
- Key Concepts: [main ideas and themes]

TABLE DATA (if tables present):
- Columns: [column names and meanings]
- Key Values: [notable metrics and numbers]
- Relationships: [relationships between data points]

MAIN FINDINGS:
- [summarize key conclusions]
- [describe processes or methods]
- [note important insights]

CRITICAL RULES:
1. Start IMMEDIATELY with "SEARCH INDEX:"
2. Use ONLY the format shown above
3. Include ALL specific data (numbers, dates, names)
4. NO generic greetings or questions back
5. NO markdown headers like ### or **
6. Be comprehensive but concise

Begin your response now:"""

        # Build message
        if images_base64:
            message_content = [{"type": "text", "text": str(prompt_text)}]
            for image_base64 in images_base64:
                message_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"}
                })
            message = HumanMessage(content=message_content)
            
            # Better logging
            content_desc = f"text + {len(tables_html)} tables + {len(images_base64)} images" if tables_html else f"text + {len(images_base64)} images"
            print(f"    → Chunk {chunk_index}: AI call ({content_desc})")
        else:
            message = HumanMessage(content=str(prompt_text))
            
            # Better logging
            if tables_html:
                print(f"    → Chunk {chunk_index}: AI call (text + {len(tables_html)} tables)")
            else:
                print(f"    → Chunk {chunk_index}: AI call (text only)")

        # Call AI
        response = llm.invoke([message])

        if not response or not response.content:
            print(f"    ⚠ Empty AI response")
            return cleaned_text

        summary = response.content.strip()

        # Validate response
        validation_result = validate_ai_summary(summary, cleaned_text)
        if not validation_result['is_valid']:
            print(f"    ⚠ Invalid AI response: {validation_result['reason']}")
            return cleaned_text

        print(f"    ✓ Valid summary ({len(summary)} chars)")
        return summary

    except Exception as e:
        print(f"    ❌ AI summary failed: {e}")
        return text


def clean_text_for_ai(text):
    """Clean text to improve AI processing"""
    import re
    text = re.sub(r'\s+', ' ', text)  # Remove excessive whitespace
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)  # Fix camelCase
    text = re.sub(r'\s+[a-zA-Z]\s+', ' ', text)  # Remove isolated chars
    return text.strip()

def validate_ai_summary(summary, original_text):
    """Validate AI summary quality"""
    if len(summary) < 50:
        return {'is_valid': False, 'reason': 'Too short'}

    # Check for generic starts
    generic_starts = ['HELLO', 'HI', 'HOW CAN I', "I'M HERE"]
    if any(summary.upper().startswith(start) for start in generic_starts):
        return {'is_valid': False, 'reason': 'Generic greeting'}

    # Check for scattered characters
    words = summary.split()
    if len([w for w in words if len(w) == 1]) > len(words) * 0.3:
        return {'is_valid': False, 'reason': 'Too many single characters'}

    return {'is_valid': True, 'reason': 'Valid'}

def store_chunks_with_embeddings(document_id: str, processed_chunks: list):
    """Generate embeddings and store chunks"""
    print("🔢 Generating embeddings and storing chunks...")
    start_time = time.time()

    if not processed_chunks:
        return []

    # Generate embeddings
    texts = [chunk_data['content'] for chunk_data in processed_chunks]
    batch_size = 20
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        batch_embeddings = embeddings_model.embed_documents(batch_texts)
        all_embeddings.extend(batch_embeddings)
        print(f"  ✅ Batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")

    # Store chunks
    stored_chunk_ids = []
    for i, (chunk_data, embedding) in enumerate(zip(processed_chunks, all_embeddings)):
        chunk_data_with_embedding = {
            **chunk_data,
            'document_id': document_id,
            'chunk_index': i,
            'embedding': embedding
        }
        result = supabase.table('document_chunks').insert(chunk_data_with_embedding).execute()
        stored_chunk_ids.append(result.data[0]['id'])

    print(f"✅ Stored {len(processed_chunks)} chunks")
    print(f"⏱ [TIMING] store_chunks_with_embeddings: {time.time() - start_time:.2f}s")
    return stored_chunk_ids
