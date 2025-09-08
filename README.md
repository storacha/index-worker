# index-worker

Index worker is a cloudflare worker that generates an index for a CAR file.

## API

### `GET /index/{key}`

Index a key in the bucket.

Returns newline delimited dag-json. e.g.

```js
// [multihash, [offset, length]]
[{"/":{"bytes":"EiANNuDDCZUo8wPAjW9/pSog/UoPdP6RllJIloT4PCHxaA"}},[98,1048576]]
[{"/":{"bytes":"EiBgL8yuPQqboDoblfIsgDeJCvDsKKLX7SrdUSnk1QboGQ"}},[1048713,79616]]
[{"/":{"bytes":"EiBhK/1XBIQzPT6Cd7CYvKokGp0hRrXcVU7CV0LRxswWDQ"}},[1128367,108]]
```

Note: supports `?offset=` querystring parameter. This allows indexing of HUGE DAGs. Use `stat` call (below) to get full size of the file. Next, track the last received offset if the response ends before the offset reaches the end of the file you need to make an additional request with the `?offset=` parameter.

### `GET /stat/{key}`

Get the size in bytes of a given key.

Returns JSON. e.g.

```json
{"size":1128475}
```

### `GET /serve/{key}`

Get the bytes of the given key.

Note: Supports HTTP `Range` header.

### `GET /hash/{key}`

Compute sha2-256 hash for the key.

Returns dag-json. e.g.

```json
{"/":{"bytes":"EiDWta59x/xP90v+TdAt1HWcxjGrQSp4ikNkWkgOM8zfVw"}}
```
