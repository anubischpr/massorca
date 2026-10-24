import type { Platform } from './MobileHero'
import { translate } from '@/i18n/i18n'
import {
  MASSORCA_MOBILE_ANDROID_RELEASES_URL,
  MASSORCA_MOBILE_GUIDE_URL
} from '../../../../shared/massorca-distribution'

// iOS ships two App Store tracks: the public App Store build (slower, ~weekly)
// and the TestFlight preview build (daily). Android only ships one APK track.
export type IosChannel = 'stable' | 'preview'

export type InstallCopy = { ctaLabel: string; url: string }

export const ANDROID_INSTALL_GUIDE_URL = `${MASSORCA_MOBILE_GUIDE_URL}#android`

// Why: MassOrca has no App Store or TestFlight listing; those are upstream Orca's, a different app.
const IOS_STATUS_COPY: InstallCopy = {
  ctaLabel: 'See iOS status',
  url: `${MASSORCA_MOBILE_GUIDE_URL}#ios`
}

const IOS_CHANNEL_COPY: Record<IosChannel, InstallCopy> = {
  stable: IOS_STATUS_COPY,
  preview: IOS_STATUS_COPY
}

const ANDROID_COPY: InstallCopy = {
  ctaLabel: 'Download APK',
  url: MASSORCA_MOBILE_ANDROID_RELEASES_URL
}

export function getInstallCopy(platform: Platform, iosChannel: IosChannel): InstallCopy {
  return platform === 'ios' ? IOS_CHANNEL_COPY[iosChannel] : ANDROID_COPY
}

export function getChannelTagline(iosChannel: IosChannel): string {
  return iosChannel === 'preview'
    ? translate(
        'auto.components.mobile.mobile.platform.copy.preview.tagline',
        'Newest features, updated daily.'
      )
    : translate(
        'auto.components.mobile.mobile.platform.copy.stable.tagline',
        'The public release, updated weekly.'
      )
}
