window.__ModuleLoader__.load({
  id: '@local/audio-extract',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useCallback, useEffect } = React

    const VIDEO_RE = /\.(mp4|mov|mkv|avi|m4v|wmv|flv|ts|mts|webm|3gp)$/i

    const T = {
      text: 'var(--dsw-alias-label-primary, currentColor)',
      sub: 'var(--dsw-alias-label-secondary, currentColor)',
      border: 'var(--dsw-alias-border-l1, rgba(128,128,128,.28))',
      layer: 'var(--dsw-alias-bg-layer-1, transparent)',
      layer2: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.10))',
      brand: 'var(--dsw-alias-brand-primary, #4a6cf7)',
      error: 'var(--dsw-alias-state-error-primary, #d93025)',
      success: 'var(--dsw-alias-state-success-primary, #159c57)',
    }

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '7px 10px',
      borderRadius: 8,
      border: '1px solid ' + T.border,
      background: T.layer2,
      color: T.text,
      fontSize: 12.5,
      outline: 'none',
      fontFamily: 'inherit',
    }

    const ghostButton = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 8,
      border: '1px solid ' + T.border,
      background: 'transparent',
      color: T.text,
      fontSize: 12.5,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }

    const primaryButton = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 18px',
      borderRadius: 8,
      border: '1px solid color-mix(in srgb, ' + T.brand + ' 55%, transparent)',
      background: 'color-mix(in srgb, ' + T.brand + ' 16%, transparent)',
      color: T.brand,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    }

    const cardStyle = {
      border: '1px solid ' + T.border,
      background: T.layer,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'grid',
      gap: 10,
    }

    const labelStyle = {
      fontSize: 11.5,
      color: T.sub,
      marginBottom: 5,
      display: 'block',
      letterSpacing: '.02em',
    }

    let clientCtx = null

    function b64(text) {
      const bytes = new TextEncoder().encode(text)
      let binary = ''
      bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
      return btoa(binary)
    }

    function emptyRow(file) {
      return {
        file,
        title: file ? file.replace(VIDEO_RE, '') : '',
        artist: '',
        cover: '',
        lyrics: '',
        checked: true,
      }
    }

    function pickLocalFile(accept, onFile) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.style.display = 'none'
      input.addEventListener('change', () => {
        const file = input.files && input.files[0]
        if (file) onFile(file)
        input.remove()
      })
      document.body.appendChild(input)
      input.click()
    }

    function AudioExtractView(props) {
      const [folder, setFolder] = useState('C:\\Users\\xc\\Desktop')
      const [trimStart, setTrimStart] = useState('0')
      const [trimEnd, setTrimEnd] = useState('0')
      const [rows, setRows] = useState([])
      const [scanning, setScanning] = useState(false)
      const [busy, setBusy] = useState(false)
      const [status, setStatus] = useState({ kind: '', text: '' })

      const scan = useCallback(async (dir) => {
        setScanning(true)
        try {
          const response = await fetch('/audio-extract/list?path=' + encodeURIComponent(dir), {
            credentials: 'same-origin',
            cache: 'no-store',
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || !data || data.ok === false) {
            throw new Error((data && data.error) || ('HTTP ' + response.status))
          }
          const names = (Array.isArray(data.files) ? data.files : [])
            .map((entry) => (typeof entry === 'string' ? entry : entry && entry.name))
            .filter((name) => typeof name === 'string' && name)
          setRows((previous) => {
            const byName = new Map(previous.map((row) => [row.file, row]))
            return names.map((name) => byName.get(name) || emptyRow(name))
          })
          setStatus(names.length
            ? { kind: '', text: '找到 ' + names.length + ' 个视频' }
            : { kind: '', text: '这个文件夹里没有视频文件' })
        } catch (error) {
          setStatus({ kind: 'error', text: '读取文件夹失败：' + String(error?.message ?? error) + '（可点「添加文件」手动填写）' })
        } finally {
          setScanning(false)
        }
      }, [])

      useEffect(() => { scan('C:\\Users\\xc\\Desktop') }, [scan])

      const pickFolder = useCallback(async () => {
        const api = clientCtx && clientCtx.uiWorkspace
        if (!api || typeof api.pickDirectory !== 'function') {
          setStatus({ kind: 'error', text: '当前环境不支持文件夹选择' })
          return
        }
        try {
          const picked = await api.pickDirectory()
          if (picked) {
            setFolder(picked)
            await scan(picked)
          }
        } catch (error) {
          setStatus({ kind: 'error', text: '选择文件夹失败：' + String(error?.message ?? error) })
        }
      }, [scan])

      const updateRow = useCallback((index, patch) => {
        setRows((previous) => previous.map((row, i) => (i === index ? Object.assign({}, row, patch) : row)))
      }, [])

      const chooseCover = useCallback((index) => {
        pickLocalFile('image/*', async (file) => {
          setStatus({ kind: '', text: '正在上传封面…' })
          try {
            const buffer = await file.arrayBuffer()
            const response = await fetch('/audio-extract/upload?name=' + encodeURIComponent(file.name), {
              method: 'POST',
              body: buffer,
              headers: { 'content-type': 'application/octet-stream' },
              credentials: 'same-origin',
            })
            const data = await response.json().catch(() => null)
            if (!response.ok || !data || data.ok !== true) {
              throw new Error((data && data.error) || ('HTTP ' + response.status))
            }
            updateRow(index, { cover: data.path })
            setStatus({ kind: 'success', text: '封面已就绪' })
          } catch (error) {
            setStatus({ kind: 'error', text: '封面上传失败：' + String(error?.message ?? error) })
          }
        })
      }, [updateRow])

      const chooseLyrics = useCallback((index) => {
        pickLocalFile('.lrc,.txt,text/plain', async (file) => {
          try {
            const text = await file.text()
            updateRow(index, { lyrics: text.split(/\r?\n/).slice(0, 200).join('\n') })
            setStatus({ kind: 'success', text: '歌词已读取：' + file.name })
          } catch (error) {
            setStatus({ kind: 'error', text: '读取歌词失败：' + String(error?.message ?? error) })
          }
        })
      }, [updateRow])

      const submit = useCallback(async () => {
        if (busy) return
        const items = rows
          .filter((row) => row.checked && String(row.file || '').trim())
          .map((row) => ({
            file: String(row.file).trim(),
            title: String(row.title || '').trim(),
            artist: String(row.artist || '').trim(),
            cover: String(row.cover || '').trim(),
            lyrics: String(row.lyrics || '').trim(),
          }))
        if (!items.length) {
          setStatus({ kind: 'error', text: '请至少勾选一个视频文件' })
          return
        }
        const api = clientCtx && clientCtx.remote && clientCtx.remote.commands
        if (!api || !props.sessionId) {
          setStatus({ kind: 'error', text: '当前环境无法调用 Host 命令，请刷新页面后重试' })
          return
        }
        setBusy(true)
        setStatus({ kind: '', text: '正在提取，请稍候…' })
        try {
          const payload = {
            folder: String(folder).trim(),
            trimStart: Number(trimStart) || 0,
            trimEnd: Number(trimEnd) || 0,
            items,
          }
          await api.execute(props.sessionId, '/audio-extract ' + b64(JSON.stringify(payload)), [])
          setStatus({ kind: 'success', text: '已提交，结果会出现在对话的命令输出里' })
        } catch (error) {
          setStatus({ kind: 'error', text: '提取失败：' + String(error?.message ?? error) })
        } finally {
          setBusy(false)
        }
      }, [busy, folder, rows, trimEnd, trimStart, props.sessionId])

      const statusColor = status.kind === 'error' ? T.error : status.kind === 'success' ? T.success : T.sub
      const selectedCount = rows.filter((row) => row.checked).length

      return h('div', {
        style: { padding: '28px 32px 40px', height: '100%', overflow: 'auto', boxSizing: 'border-box', color: T.text },
      },
      h('div', { style: { maxWidth: 900, margin: '0 auto', display: 'grid', gap: 14 } },
        h('div', null,
          h('div', { style: { fontSize: 19, fontWeight: 650, letterSpacing: '.01em' } }, '音频提取'),
          h('div', { style: { fontSize: 12.5, color: T.sub, marginTop: 5, lineHeight: 1.7 } },
            '从视频里无损提取音轨（流复制，不重新编码），可裁剪开头与结尾，并写入歌名、歌手、封面与歌词。')
        ),

        h('div', { style: cardStyle },
          h('div', null,
            h('label', { style: labelStyle }, '视频文件夹'),
            h('div', { style: { display: 'flex', gap: 8 } },
              h('input', {
                style: Object.assign({}, inputStyle, { flex: '1 1 auto' }),
                value: folder,
                spellCheck: false,
                onChange: (event) => setFolder(event.target.value),
                placeholder: 'C:\\Users\\xc\\Desktop',
              }),
              h('button', { style: ghostButton, onClick: pickFolder }, '选择文件夹'),
              h('button', {
                style: Object.assign({}, ghostButton, scanning ? { opacity: .6 } : null),
                disabled: scanning,
                onClick: () => scan(folder),
              }, scanning ? '扫描中…' : '重新扫描')
            )
          ),
          h('div', { style: { display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' } },
            h('div', { style: { width: 130 } },
              h('label', { style: labelStyle }, '开头剪掉（秒）'),
              h('input', {
                style: inputStyle,
                value: trimStart,
                inputMode: 'decimal',
                onChange: (event) => setTrimStart(event.target.value),
              })
            ),
            h('div', { style: { width: 130 } },
              h('label', { style: labelStyle }, '结尾剪掉（秒）'),
              h('input', {
                style: inputStyle,
                value: trimEnd,
                inputMode: 'decimal',
                onChange: (event) => setTrimEnd(event.target.value),
              })
            )
          )
        ),

        h('div', { style: cardStyle },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } },
            h('div', { style: { fontSize: 12.5, color: T.sub } },
              rows.length ? '歌曲清单 · 已选 ' + selectedCount + '/' + rows.length : '歌曲清单 · 暂无条目'),
            h('button', {
              style: ghostButton,
              onClick: () => setRows((previous) => previous.concat([emptyRow('')])),
            }, '添加文件')
          ),

          rows.length === 0
            ? h('div', { style: { fontSize: 12.5, color: T.sub, lineHeight: 1.8 } },
                '选择文件夹后会自动列出其中的视频；也可以点「添加文件」手动填写文件名，或直接刷新页面重试。')
            : h('div', { style: { display: 'grid', gap: 12 } }, rows.map((row, index) => h('div', {
                key: String(index) + ':' + row.file,
                style: {
                  border: '1px solid ' + T.border,
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'grid',
                  gap: 8,
                },
              },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                h('input', {
                  type: 'checkbox',
                  checked: row.checked,
                  onChange: (event) => updateRow(index, { checked: event.target.checked }),
                  style: { width: 15, height: 15, accentColor: T.brand, cursor: 'pointer', margin: 0, flex: '0 0 auto' },
                }),
                h('input', {
                  style: Object.assign({}, inputStyle, { flex: '1 1 auto', background: 'transparent', border: '1px solid transparent', padding: '3px 4px' }),
                  value: row.file,
                  spellCheck: false,
                  placeholder: '视频文件名',
                  onChange: (event) => updateRow(index, { file: event.target.value }),
                }),
                h('button', {
                  style: Object.assign({}, ghostButton, { border: '1px solid transparent', color: T.sub, padding: '3px 6px' }),
                  onClick: () => setRows((previous) => previous.filter((_, i) => i !== index)),
                }, '移除')
              ),
              h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingLeft: 25 } },
                h('input', {
                  style: inputStyle,
                  value: row.title,
                  placeholder: '歌名',
                  onChange: (event) => updateRow(index, { title: event.target.value }),
                }),
                h('input', {
                  style: inputStyle,
                  value: row.artist,
                  placeholder: '歌手',
                  onChange: (event) => updateRow(index, { artist: event.target.value }),
                }),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('input', {
                    style: inputStyle,
                    value: row.cover,
                    placeholder: '封面图片（可选取）',
                    spellCheck: false,
                    onChange: (event) => updateRow(index, { cover: event.target.value }),
                  }),
                  h('button', {
                    style: Object.assign({}, ghostButton, { padding: '6px 10px' }),
                    onClick: () => chooseCover(index),
                  }, '选择图片')
                ),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('input', {
                    style: inputStyle,
                    value: row.lyrics ? String(row.lyrics).replace(/\s+/g, ' ').slice(0, 40) : '',
                    placeholder: '歌词（可选取 .lrc/.txt）',
                    onChange: (event) => updateRow(index, { lyrics: event.target.value }),
                  }),
                  h('button', {
                    style: Object.assign({}, ghostButton, { padding: '6px 10px' }),
                    onClick: () => chooseLyrics(index),
                  }, '选择歌词')
                )
              )
            )))
        ),

        h('div', { style: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' } },
          h('button', {
            style: Object.assign({}, primaryButton, busy || scanning ? { opacity: .55, cursor: 'default' } : null),
            disabled: busy,
            onClick: submit,
          }, busy ? '提取中…' : '开始提取'),
          status.text ? h('div', { style: { fontSize: 12.5, color: statusColor, lineHeight: 1.6 } }, status.text) : null
        )
      ))
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'uiWorkspace'],
      apply(ctx) {
        clientCtx = ctx
        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view',
          id: 'audio-extract',
          order: 31,
          label: '音频提取',
        }, AudioExtractView))
      },
    }
  },
})
