'use client'

/**
 * TrafficLab launch console — Bootstrap 5.3 controls.
 * Logic preserved 1:1 from the previous implementation:
 * react-hook-form + zod domain validation, all seven engine options,
 * loop-mode warning and stop-all action.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  domain: z
    .string()
    .min(3, 'Enter a domain')
    .max(253, 'Too long')
    .refine(v => /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(v.trim().split('/')[0].split('://').pop() ?? ''), {
      message: 'Use a public domain like example.com',
    }),
})

type FormValues = z.infer<typeof schema>

export interface LaunchOptions {
  domain: string
  threads: number
  minClicks: number
  maxClicks: number
  timeout: number
  maxOffset: number
  secure: boolean
  forever: boolean
  useProxies: boolean
}

interface SliderSpec {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  help: string
}

/** Ranges identical to the previous shadcn sliders (and engine caps). */
const SLIDERS: SliderSpec[] = [
  { id: 'threads', label: 'Parallel sessions', min: 1, max: 4, step: 1, unit: '', help: 'Selenium workers browsing at once' },
  { id: 'maxClicks', label: 'Clicks per page (max)', min: 2, max: 10, step: 1, unit: '', help: 'Depth of each browsing session' },
  { id: 'timeout', label: 'Page timeout', min: 10, max: 90, step: 5, unit: 's', help: 'Max wait for a page to load' },
  { id: 'maxOffset', label: 'Human-like delay', min: 1, max: 20, step: 1, unit: 's', help: 'Pause scale between clicks' },
]

export function LaunchConsole({
  disabled,
  onLaunch,
  busy,
  activeCount,
  onStopAll,
}: {
  disabled: boolean
  busy: boolean
  activeCount: number
  onLaunch: (opts: LaunchOptions) => Promise<{ ok: boolean; error?: string }>
  onStopAll: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { domain: '' } })

  const [threads, setThreads] = useState(2)
  const [minClicks, setMinClicks] = useState(1)
  const [maxClicks, setMaxClicks] = useState(4)
  const [timeout, setTimeoutSec] = useState(20)
  const [maxOffset, setMaxOffset] = useState(8)
  const [secure, setSecure] = useState(true)
  const [forever, setForever] = useState(false)
  const [useProxies, setUseProxies] = useState(false)

  const sliderValues: Record<string, [number, (v: number) => void]> = {
    threads: [threads, setThreads],
    maxClicks: [maxClicks, setMaxClicks],
    timeout: [timeout, setTimeoutSec],
    maxOffset: [maxOffset, setMaxOffset],
  }

  const onSubmit = handleSubmit(async values => {
    const result = await onLaunch({
      domain: values.domain.trim(),
      threads,
      minClicks,
      maxClicks,
      timeout,
      maxOffset,
      secure,
      forever,
      useProxies,
    })
    if (!result.ok && result.error) toast.error(result.error)
  })

  const domainError = !!errors.domain

  return (
    <section className="col-12 col-xl-6" aria-label="Launch console">
      <div className="card p-3 p-md-4 h-100 tl-rise">
        <div className="d-flex align-items-center mb-3">
          <h2 className="h6 fw-bold mb-0">Launch console</h2>
          <span className="chip px-2 py-1 small ms-auto">
            {activeCount > 0 ? `${activeCount} running` : 'Ready'}
          </span>
        </div>

        <form onSubmit={onSubmit} noValidate>
          {/* target domain */}
          <div className="input-group has-validation">
            <span className="input-group-text">
              <i className="bi bi-globe2" aria-hidden="true" />
            </span>
            <input
              id="domain"
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={`form-control form-control-lg fs-6${domainError ? ' is-invalid' : ''}`}
              placeholder="example.com"
              aria-label="Target domain"
              aria-invalid={domainError}
              {...register('domain')}
            />
            <button className="btn btn-tl px-4" type="submit" disabled={disabled || busy}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                  Launching
                </>
              ) : (
                <>
                  <i className="bi bi-rocket-takeoff me-1" aria-hidden="true" />
                  Launch
                </>
              )}
            </button>
            {domainError && <div className="invalid-feedback d-block">{errors.domain?.message}</div>}
          </div>
          <div className="form-text text-mut mb-3">
            {domainError
              ? ''
              : 'Only launch toward sites you own or are authorized to test.'}
          </div>

          {/* sliders */}
          <div className="row g-3 mb-2">
            {SLIDERS.map(s => {
              const [value, setValue] = sliderValues[s.id]
              return (
                <div className="col-sm-6" key={s.id}>
                  <label className="d-flex justify-content-between fw-semibold small" htmlFor={s.id}>
                    {s.label}
                    <b className="text-acc">
                      {value}
                      {s.unit}
                    </b>
                  </label>
                  <input
                    id={s.id}
                    type="range"
                    className="form-range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={value}
                    aria-label={s.label}
                    onChange={e => setValue(Number(e.target.value))}
                  />
                  <small className="text-mut">{s.help}</small>
                </div>
              )
            })}
          </div>

          {/* switches */}
          <div className="row g-2 mt-2">
            <div className="col-12 col-md-4">
              <label className="toggle d-flex justify-content-between align-items-center fw-semibold small" htmlFor="secure">
                HTTPS
                <span className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="secure"
                    checked={secure}
                    onChange={e => setSecure(e.target.checked)}
                    aria-label="Use HTTPS"
                  />
                </span>
              </label>
            </div>
            <div className="col-12 col-md-4">
              <label className="toggle d-flex justify-content-between align-items-center fw-semibold small" htmlFor="forever">
                Loop mode
                <span className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="forever"
                    checked={forever}
                    onChange={e => setForever(e.target.checked)}
                    aria-label="Run forever"
                  />
                </span>
              </label>
            </div>
            <div className="col-12 col-md-4">
              <label className="toggle d-flex justify-content-between align-items-center fw-semibold small" htmlFor="proxies">
                Proxies
                <span className="form-check form-switch m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="proxies"
                    checked={useProxies}
                    onChange={e => setUseProxies(e.target.checked)}
                    aria-label="Use proxies"
                  />
                </span>
              </label>
            </div>
          </div>

          {forever && (
            <div
              className="alert py-2 small d-flex align-items-center gap-2 mt-3 mb-0"
              role="alert"
              style={{ background: 'rgba(255,185,56,.08)', border: '1px solid rgba(255,185,56,.35)', color: 'var(--tl-amb)' }}
            >
              <i className="bi bi-shield-exclamation" aria-hidden="true" />
              <span>
                <b>Loop mode is on.</b> Sessions restart endlessly until you stop them — use the Stop
                controls in the live monitor.
              </span>
            </div>
          )}
        </form>

        {activeCount > 0 && (
          <button type="button" className="btn btn-tl stop w-100 mt-3" onClick={onStopAll}>
            <i className="bi bi-slash-circle me-1" aria-hidden="true" />
            Stop all active sessions ({activeCount})
          </button>
        )}
      </div>
    </section>
  )
}
