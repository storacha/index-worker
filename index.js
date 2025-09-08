import crypto from 'node:crypto'
import { CARReaderStream } from 'carstream'
import { encodeHeader } from 'carstream/writer'
import * as dagJSON from '@ipld/dag-json'
import * as Digest from 'multiformats/hashes/digest'
import { sha256 } from 'multiformats/hashes/sha2'

const newline = new TextEncoder().encode('\n')

export default {
  /**
   * @param {Request} request
   * @param {{ BUCKET: import('@cloudflare/workers-types').R2Bucket }} env
   */
  async fetch (request, env) {
    const { pathname, searchParams } = new URL(request.url)
    const [, op, ...rest] = pathname.split('/')
    const key = rest.join('/')

    if (op === 'index') {
      let offset = parseInt(searchParams.get('offset') ?? '0')
      const obj = await env.BUCKET.get(key, { range: { offset } })
      if (!obj) {
        return new Response(null, { status: 404 })
      }
      let body = obj.body

      if (offset) {
        const header = encodeHeader([])
        // add a fake header
        body = body.pipeThrough(new TransformStream({
          start (controller) {
            controller.enqueue(header)
          }
        }))
        offset -= header.length
      }

      body = body
        .pipeThrough(new CARReaderStream())
        .pipeThrough(new TransformStream({
          transform (block, controller) {
            const bytes = dagJSON.encode([block.cid.multihash.bytes, [offset + block.blockOffset, block.blockLength]])
            controller.enqueue(bytes)
            controller.enqueue(newline)
          }
        }))

      return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } })
    } else if (op === 'stat') {
      const obj = await env.BUCKET.head(key)
      if (!obj) {
        return new Response(null, { status: 404 })
      }
      return new Response(dagJSON.encode({ size: obj.size }), { headers: { 'Content-Type': 'application/json' } })
    } else if (op === 'serve') {
      let range = {}
      if (request.headers.has('range')) {
        const rangeHeader = request.headers.get('range')
        const [first, last] = rangeHeader.slice(6).split('-').map(n => parseInt(n))
        range = { offset: first, length: last - first + 1 }
      }
      const obj = await env.BUCKET.get(key, { range })
      if (!obj) {
        return new Response(null, { status: 404 })
      }
      return new Response(obj.body, { status: request.headers.has('range') ? 206 : 200 })
    } else if (op === 'hash') {
      const obj = await env.BUCKET.get(key)
      if (!obj) {
        return new Response(null, { status: 404 })
      }

      const hash = crypto.createHash('sha256')
      await obj.body
        .pipeTo(new WritableStream({ write (chunk) { hash.update(chunk) } }))

      const digest = Digest.create(sha256.code, hash.digest())
      return new Response(dagJSON.encode(digest.bytes), { headers: { 'Content-Type': 'application/json' } })
    } else {
      return new Response(null, { status: 400 })
    }
  }
}
