import { useId } from 'react'

// All Genie logo artwork lives in this file. Master mark from design/mark.svg, small cut from
// design/favicon.svg, wordmark outlines from design/logo.svg. Colors follow the app theme through
// currentColor and tokens, never the OS media query.

const SMALL_CUT_BELOW_PX = 24
const WORDMARK_PATH =
  'M11.92 6.48Q9.12 6.48 7.12 5.72Q5.12 4.96 3.90 3.58Q2.68 2.20 2.20 0.40L7.48 0.04Q7.88 1.24 8.86 1.92Q9.84 2.60 11.92 2.60Q14.28 2.60 15.56 1.54Q16.84 0.48 16.84-1.76L16.84-4.48Q16.08-2.92 14.40-1.98Q12.72-1.04 10.64-1.04Q8-1.04 5.94-2.34Q3.88-3.64 2.72-5.98Q1.56-8.32 1.56-11.40Q1.56-14.48 2.70-16.82Q3.84-19.16 5.88-20.50Q7.92-21.84 10.56-21.84Q12.88-21.84 14.56-20.80Q16.24-19.76 17-18.04L17-21.36L22-21.36L22-1.88Q22 0.84 20.74 2.72Q19.48 4.60 17.22 5.54Q14.96 6.48 11.92 6.48M11.84-5.04Q14.12-5.04 15.48-6.74Q16.84-8.44 16.88-11.44Q16.92-13.44 16.30-14.86Q15.68-16.28 14.54-17.06Q13.40-17.84 11.84-17.84Q9.48-17.84 8.18-16.10Q6.88-14.36 6.88-11.44Q6.88-8.52 8.22-6.78Q9.56-5.04 11.84-5.04M36.24 0.48Q33.04 0.48 30.68-0.90Q28.32-2.28 27.04-4.80Q25.76-7.32 25.76-10.68Q25.76-14.04 27.04-16.54Q28.32-19.04 30.66-20.44Q33-21.84 36.12-21.84Q39.16-21.84 41.46-20.48Q43.76-19.12 45-16.56Q46.24-14 46.24-10.40L46.24-9.24L31.08-9.24Q31.24-6.44 32.62-5.02Q34-3.60 36.28-3.60Q38-3.60 39.14-4.38Q40.28-5.16 40.72-6.56L45.96-6.24Q45.08-3.12 42.50-1.32Q39.92 0.48 36.24 0.48M31.08-12.68L40.96-12.68Q40.80-15.28 39.48-16.54Q38.16-17.80 36.12-17.80Q34.08-17.80 32.74-16.48Q31.40-15.16 31.08-12.68M55.16 0L50.04 0L50.04-21.36L54.68-21.36L54.80-17.72Q55.12-18.56 55.60-19.20Q56.60-20.56 58.04-21.20Q59.48-21.84 61.20-21.84Q63.56-21.84 65.18-20.80Q66.80-19.76 67.64-17.94Q68.48-16.12 68.48-13.72L68.48 0L63.36 0L63.36-12.08Q63.36-13.88 63-15.12Q62.64-16.36 61.82-17.02Q61-17.68 59.64-17.68Q57.60-17.68 56.38-16.24Q55.16-14.80 55.16-12.08M78.60 0L73.48 0L73.48-21.36L78.60-21.36L78.60 0M78.72-24.20L73.40-24.20L73.40-28.76L78.72-28.76M92.88 0.48Q89.68 0.48 87.32-0.90Q84.96-2.28 83.68-4.80Q82.40-7.32 82.40-10.68Q82.40-14.04 83.68-16.54Q84.96-19.04 87.30-20.44Q89.64-21.84 92.76-21.84Q95.80-21.84 98.10-20.48Q100.40-19.12 101.64-16.56Q102.88-14 102.88-10.40L102.88-9.24L87.72-9.24Q87.88-6.44 89.26-5.02Q90.64-3.60 92.92-3.60Q94.64-3.60 95.78-4.38Q96.92-5.16 97.36-6.56L102.60-6.24Q101.72-3.12 99.14-1.32Q96.56 0.48 92.88 0.48M87.72-12.68L97.60-12.68Q97.44-15.28 96.12-16.54Q94.80-17.80 92.76-17.80Q90.72-17.80 89.38-16.48Q88.04-15.16 87.72-12.68'

function MarkShapes({ small }: { small: boolean }) {
  if (small) {
    return (
      <>
        <path d="M7 23V16A5 5 0 0 1 12 11H52A5 5 0 0 1 57 16V48A5 5 0 0 1 52 53H12A5 5 0 0 1 7 48V41" fill="none" stroke="currentColor" strokeWidth="10"/><rect x="0" y="27.5" width="38" height="9" rx="4.5"/>
      </>
    )
  }
  return (
    <>
      <path d="M7.5 25V17.5A6 6 0 0 1 13.5 11.5H50.5A6 6 0 0 1 56.5 17.5V46.5A6 6 0 0 1 50.5 52.5H13.5A6 6 0 0 1 7.5 46.5V39" fill="none" stroke="currentColor" strokeWidth="7"/><rect x="1" y="28.5" width="44" height="7" rx="3.5"/><rect x="22" y="18.5" width="26" height="7" rx="3.5"/><rect x="22" y="38.5" width="16" height="7" rx="3.5"/>
    </>
  )
}

interface MarkProps {
  // Pixel size of the square mark. Below 24 px the high-contrast small cut is drawn.
  size?: number
  className?: string
  // Decorative by default. Pass a label when the mark stands alone.
  label?: string
}

export function Mark({ size = 28, className = '', label }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="currentColor"
      className={`text-accent ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <MarkShapes small={size < SMALL_CUT_BELOW_PX} />
    </svg>
  )
}

interface LogoProps {
  // Height of the lockup in pixels. The mark is 28 px at the default 28.
  height?: number
  className?: string
  // When an admin renames the app, the mark is shown with that name in Geist 600 instead of the wordmark.
  appName?: string
}

export function Logo({ height = 28, className = '', appName }: LogoProps) {
  const titleId = useId()
  if (appName && appName.toLowerCase() !== 'genie') {
    return (
      <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className}`} style={{ fontSize: height * 0.64 }}>
        <Mark size={height} />
        <span>{appName}</span>
      </span>
    )
  }
  return (
    <svg
      viewBox="0 0 155 46"
      height={height}
      width={(height * 155) / 46}
      fill="currentColor"
      className={`text-accent ${className}`}
      role="img"
      aria-labelledby={titleId}
      focusable="false"
    >
      <title id={titleId}>Genie</title>
      <g transform="translate(1.5 0) scale(.72)">
        <path d="M7.5 25V17.5A6 6 0 0 1 13.5 11.5H50.5A6 6 0 0 1 56.5 17.5V46.5A6 6 0 0 1 50.5 52.5H13.5A6 6 0 0 1 7.5 46.5V39" fill="none" stroke="currentColor" strokeWidth="7"/><rect x="1" y="28.5" width="44" height="7" rx="3.5"/><rect x="22" y="18.5" width="26" height="7" rx="3.5"/><rect x="22" y="38.5" width="16" height="7" rx="3.5"/>
      </g>
      <path className="fill-ink" transform="translate(50 33.5)" d={WORDMARK_PATH} />
    </svg>
  )
}
