import {
  IconArrowsExchange,
  IconBolt,
  IconBriefcase,
  IconBuilding,
  IconBuildingBank,
  IconCar,
  IconCash,
  IconCreditCard,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDeviceTv,
  IconDots,
  IconHeartRateMonitor,
  IconHome,
  IconPercentage,
  IconPigMoney,
  IconPlus,
  IconReceiptTax,
  IconRepeat,
  IconScale,
  IconSpeakerphone,
  IconToolsKitchen2,
  IconTransfer,
  IconTrendingUp,
  IconUsers,
  IconWifi,
} from '@tabler/icons-react'

/**
 * Categories store their icon as a kebab-case name (see db/defaults), so rows
 * stay plain serializable data in IndexedDB. This resolves one to a component.
 */
const ICONS = {
  cash: IconCash,
  repeat: IconRepeat,
  briefcase: IconBriefcase,
  percentage: IconPercentage,
  'device-laptop': IconDeviceLaptop,
  building: IconBuilding,
  bolt: IconBolt,
  wifi: IconWifi,
  car: IconCar,
  'tools-kitchen-2': IconToolsKitchen2,
  users: IconUsers,
  speakerphone: IconSpeakerphone,
  'receipt-tax': IconReceiptTax,
  'device-desktop': IconDeviceDesktop,
  'building-bank': IconBuildingBank,
  scale: IconScale,

  // Personal profile.
  'trending-up': IconTrendingUp,
  'arrows-exchange': IconArrowsExchange,
  plus: IconPlus,
  home: IconHome,
  'heart-rate-monitor': IconHeartRateMonitor,
  'device-tv': IconDeviceTv,
  'pig-money': IconPigMoney,
  'credit-card': IconCreditCard,
  dots: IconDots,
}

export function categoryIcon(iconName) {
  return ICONS[iconName] ?? IconTransfer
}

export default ICONS
