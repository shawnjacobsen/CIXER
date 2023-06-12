// generic helper functions

export function get_datetime() {
  const now = new Date()
  return now.toDateString()
}

// TODO: use text splitter from openai
export function getContentChunks(content:string):Array<string> {
  text_splitter = CharacterTextSplitter(      
    separator = "\n",
    chunk_size = 1000,
    chunk_overlap  = 200,
    length_function = len,
  )
  return text_splitter.split_text(content)
}