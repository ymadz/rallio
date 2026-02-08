// Type declarations for image imports
declare module '*.png' {
    import type { StaticImageData } from 'next/image'
    const content: StaticImageData
    export default content
}

declare module '*.jpg' {
    import type { StaticImageData } from 'next/image'
    const content: StaticImageData
    export default content
}

declare module '*.jpeg' {
    import type { StaticImageData } from 'next/image'
    const content: StaticImageData
    export default content
}

declare module '*.gif' {
    import type { StaticImageData } from 'next/image'
    const content: StaticImageData
    export default content
}

declare module '*.svg' {
    import type { FC, SVGProps } from 'react'
    const content: FC<SVGProps<SVGElement>>
    export default content
}

declare module '*.webp' {
    import type { StaticImageData } from 'next/image'
    const content: StaticImageData
    export default content
}
