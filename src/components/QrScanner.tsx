import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = new (options: { formats: string[] }) => {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}

type Props = {
  onDetect: (value: string) => void
  onClose: () => void
}

export function QrScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef(0)
  const activeRef = useRef(true)
  const [error, setError] = useState('')

  useEffect(() => {
    activeRef.current = true
    let cancelled = false

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorLike }).BarcodeDetector
      if (!Detector) {
        setError('Este navegador não lê QR Code pela câmera. Você pode digitar ou colar o conteúdo do QR manualmente.')
        return
      }
      if (!window.isSecureContext) {
        setError('A câmera exige uma conexão segura (HTTPS). Abra o app pelo link publicado.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        const detector = new Detector({ formats: ['qr_code'] })
        const tick = async () => {
          if (!activeRef.current || cancelled) return
          try {
            const codes = await detector.detect(video)
            const value = codes[0]?.rawValue
            if (value && activeRef.current) {
              activeRef.current = false
              onDetect(value)
              return
            }
          } catch {
            // Um quadro pode falhar enquanto a câmera está ajustando; continua tentando.
          }
          frameRef.current = window.requestAnimationFrame(() => void tick())
        }
        frameRef.current = window.requestAnimationFrame(() => void tick())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível acessar a câmera.')
      }
    }

    void start()
    return () => {
      cancelled = true
      activeRef.current = false
      window.cancelAnimationFrame(frameRef.current)
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [onDetect])

  return (
    <div className="qr-scanner" role="dialog" aria-modal="true" aria-label="Ler QR Code da nota">
      <div className="qr-scanner-head"><div><strong>Ler QR da nota fiscal</strong><small>Aponte a câmera para o QR Code do cupom.</small></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar leitor"><X size={18}/></button></div>
      <div className="qr-scanner-frame"><video ref={videoRef} playsInline muted/><span className="qr-scanner-corner top-left"/><span className="qr-scanner-corner top-right"/><span className="qr-scanner-corner bottom-left"/><span className="qr-scanner-corner bottom-right"/></div>
      {error ? <p className="qr-scanner-error">{error}</p> : <p className="qr-scanner-hint"><Camera size={14}/> Procurando QR Code...</p>}
    </div>
  )
}
