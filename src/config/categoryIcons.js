import {
  IconBolt,
  IconBriefcase,
  IconBuilding,
  IconBuildingBank,
  IconCar,
  IconCash,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconPercentage,
  IconReceiptTax,
  IconRepeat,
  IconScale,
  IconSpeakerphone,
  IconToolsKitchen2,
  IconTransfer,
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
}

export function categoryIcon(iconName) {
  return ICONS[iconName] ?? IconTransfer
}

export default ICONS
