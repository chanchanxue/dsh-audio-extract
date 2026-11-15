import { spawn } from 'node:child_process'
import path from 'node:path'
import { existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'

export const inject = ['commands']

const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.wmv', '.flv', '.ts', '.mts', '.webm', '.3gp'])

const FFMPEG_CANDIDATES = [
  process.env.DSH_AUDIO_EXTRACT_FFMPEG,
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
].filter(Boolean)

function resolveFfmpeg() {
  for (const candidate of FFMPEG_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  return 'ffmpeg'
}

function runProcess(command, args) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(command, args, { windowsHide: true })
    child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', (error) => resolve({ code: -1, stdout, stderr: stderr + '\n' + String(error?.message ?? error) }))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

function parseDuration(text) {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim()
}

function toSeconds(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

async function extractOne(ffmpeg, item, folder, trimStart, trimEnd) {
  const rawFile = String(item.file || '').trim()
  if (!rawFile) return { ok: false, file: rawFile, reason: '文件名为空' }
  const src = path.isAbsolute(rawFile) ? rawFile : path.join(folder, rawFile)
  if (!existsSync(src)) return { ok: false, file: rawFile, reason: '源文件不存在' }
  if (!VIDEO_EXT.has(path.extname(src).toLowerCase())) return { ok: false, file: rawFile, reason: '不是支持的视频格式' }

  const dir = path.dirname(src)
  const base = safeName(path.basename(src, path.extname(src)))
  const out = path.join(dir, base + '.m4a')

  const probe = await runProcess(ffmpeg, ['-hide_banner', '-i', src])
  const duration = parseDuration(probe.stderr)

  const start = toSeconds(trimStart)
  const end = toSeconds(trimEnd)
  let outDuration = null
  if (duration) {
    const kept = duration - start - end
    if (kept <= 0.2) return { ok: false, file: rawFile, reason: '开头+结尾裁剪超过视频时长' }
    outDuration = kept
  } else if (start || end) {
    return { ok: false, file: rawFile, reason: '无法读取时长，不能裁剪' }
  }

  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src]
  const cover = String(item.cover || '').trim()
  const coverPath = cover ? (path.isAbsolute(cover) ? cover : path.join(folder, cover)) : ''
  const hasCover = coverPath && existsSync(coverPath)
  if (hasCover) args.push('-i', coverPath)

  if (start > 0) args.push('-ss', start.toFixed(3))
  if (outDuration) args.push('-t', outDuration.toFixed(3))

  args.push('-map', '0:a:0')
  if (hasCover) args.push('-map', '1:v:0', '-c:v', 'copy', '-disposition:v:0', 'attached_pic')
  args.push('-c:a', 'copy')

  const title = String(item.title || '').trim()
  const artist = String(item.artist || '').trim()
  const album = String(item.album || '').trim()
  const lyrics = String(item.lyrics || '').trim()
  if (title) args.push('-metadata', 'title=' + title)
  if (artist) args.push('-metadata', 'artist=' + artist)
  if (album) args.push('-metadata', 'album=' + album)
  if (lyrics) args.push('-metadata', 'lyrics=' + lyrics)

  args.push('-movflags', '+faststart', out)

  const result = await runProcess(ffmpeg, args)
  if (result.code !== 0 || !existsSync(out)) {
    return { ok: false, file: rawFile, reason: (result.stderr || 'ffmpeg 失败').split('\n').filter(Boolean).slice(-2).join(' ') }
  }
  const size = statSync(out).size
  return {
    ok: true,
    file: rawFile,
    out,
    size,
    duration: outDuration ? Number(outDuration.toFixed(2)) : null,
    cover: Boolean(hasCover),
    tagged: Boolean(title || artist || lyrics),
  }
}

function decodePayload(rawInput) {
  const text = String(rawInput || '').trim()
  if (!text) throw new Error('缺少参数')
  const json = Buffer.from(text, 'base64').toString('utf8')
  const payload = JSON.parse(json)
  if (!payload || !Array.isArray(payload.items) || !payload.items.length) throw new Error('没有要处理的歌曲')
  if (!payload.folder) throw new Error('缺少视频文件夹')
  return payload
}

export function apply(ctx) {
  const ffmpeg = resolveFfmpeg()

  const webServer = ctx.get?.('webServer')
  if (webServer && typeof webServer.register === 'function') {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/audio-extract/list',
      handler: async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        try {
          const url = new URL(String(req.url ?? '/'), 'http://localhost')
          const dir = url.searchParams.get('path') ?? ''
          if (!dir) return send(400, { ok: false, error: '缺少 path 参数' })
          if (!existsSync(dir)) return send(404, { ok: false, error: '文件夹不存在：' + dir })
          const files = readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && VIDEO_EXT.has(path.extname(entry.name).toLowerCase()))
            .map((entry) => {
              let size = 0
              try { size = statSync(path.join(dir, entry.name)).size } catch { size = 0 }
              return { name: entry.name, size }
            })
            .sort((a, b) => a.name.localeCompare(b.name))
          send(200, { ok: true, dir, files })
        } catch (error) {
          send(500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }), 'audio-extract: folder list route')

    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/audio-extract/upload',
      handler: async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        try {
          const url = new URL(String(req.url ?? '/'), 'http://localhost')
          const rawName = url.searchParams.get('name') ?? 'cover.png'
          const safe = path.basename(rawName).replace(/[\\/:*?"<>|]/g, '_') || 'cover.png'
          const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
          const dir = path.join(os.tmpdir(), 'audio-extract')
          mkdirSync(dir, { recursive: true })
          const target = path.join(dir, stamp + '-' + safe)
          const chunks = []
          let total = 0
          await new Promise((resolve, reject) => {
            req.on('data', (chunk) => {
              total += chunk.length
              if (total > 12 * 1024 * 1024) {
                reject(new Error('文件超过 12 MB'))
                req.destroy()
                return
              }
              chunks.push(chunk)
            })
            req.on('end', resolve)
            req.on('error', reject)
          })
          writeFileSync(target, Buffer.concat(chunks))
          send(200, { ok: true, path: target, size: total })
        } catch (error) {
          send(500, { ok: false, error: String(error?.message ?? error) })
        }
      },
    }), 'audio-extract: upload route')
  }

  ctx.effect(() => ctx.commands.register({
    name: 'audio-extract',
    description: '从视频里无损提取音轨，支持开头/结尾裁剪，并写入歌名、歌手、封面与歌词（Base64 JSON 参数，供「音频提取」页调用）',
    input: { hint: '<base64 payload>（由音频提取页自动生成）' },
    handler: async ({ rawInput }) => {
      let payload
      try {
        payload = decodePayload(rawInput)
      } catch (error) {
        return { kind: 'error', text: '参数解析失败：' + (error?.message ?? String(error)) }
      }

      const results = []
      for (const item of payload.items) {
        results.push(await extractOne(ffmpeg, item, payload.folder, payload.trimStart, payload.trimEnd))
      }

      const ok = results.filter((item) => item.ok)
      const failed = results.filter((item) => !item.ok)
      const lines = []
      lines.push(ok.length ? `完成 ${ok.length} 首` : '没有成功提取的文件')
      for (const item of ok) {
        const mb = (item.size / 1024 / 1024).toFixed(2)
        const bits = [`${path.basename(item.out)}`, `${mb} MB`]
        if (item.duration) bits.push(`${item.duration}s`)
        if (item.cover) bits.push('含封面')
        if (item.tagged) bits.push('已写标签')
        lines.push('✔ ' + bits.join(' · '))
      }
      for (const item of failed) lines.push(`✘ ${item.file} —— ${item.reason}`)
      lines.push(`ffmpeg：${path.basename(ffmpeg)}`)
      return { kind: failed.length ? 'error' : 'success', text: lines.join('\n') }
    },
  }), 'audio-extract: /audio-extract command')
}
