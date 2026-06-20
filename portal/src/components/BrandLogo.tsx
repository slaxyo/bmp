import { Building2 } from 'lucide-react'
import { useBranding } from '../context/BrandingContext'

/** Renders the brand logo: the uploaded image if one is set, otherwise the
 *  default Building2 icon inside the caller-supplied box. */
export function BrandLogo({
  wrapperClassName = '',
  iconClassName = '',
  style,
}: {
  wrapperClassName?: string
  iconClassName?: string
  style?: React.CSSProperties
}) {
  const { logoUrl, companyName } = useBranding()
  if (logoUrl) {
    return <img src={logoUrl} alt={companyName} className={`${wrapperClassName} object-cover`} />
  }
  return (
    <div className={wrapperClassName} style={style}>
      <Building2 className={iconClassName} />
    </div>
  )
}
