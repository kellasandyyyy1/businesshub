import { useState } from 'react'

import { paymentKind } from '../lib/paymentMethods'

/**
 * A payment method's mark in a small neutral tile: the brand's own logo when
 * one is on hand (see src/lib/paymentMethods.js), otherwise a plain icon for its kind.
 */
export default function PaymentMethodIcon({ name, size = 32 }) {
  const { logo, Icon } = paymentKind(name)
  const [broken, setBroken] = useState(false)

  return (
    <span
      className="bfh-pmicon"
      data-logo={(logo && !broken) || undefined}
      // Padding in pixels from the tile's own size; a percentage would be
      // taken from the row's width and blow the tile up.
      style={{ width: size, height: size, padding: logo?.pad && !broken ? Math.round(size * 0.12) : undefined }}
      aria-hidden="true"
    >
      {logo && !broken ? (
        <img
          src={logo.src}
          alt=""
          loading="lazy"
          style={{
            objectFit: logo.fit,
            objectPosition: logo.position,
            transform: logo.zoom ? `scale(${logo.zoom})` : undefined,
          }}
          onError={() => setBroken(true)}
        />
      ) : (
        <Icon size={Math.round(size * 0.5)} stroke={1.5} />
      )}
    </span>
  )
}
