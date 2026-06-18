"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  BoltIcon,
  Key01Icon,
  Layers01Icon,
  CodeIcon,
  ReceiptTextIcon,
  Search01Icon,
  Camera01Icon,
  QrCode01Icon,
  QrCodeScanIcon,
  BookOpen01Icon,
  Shield01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  AlertCircleIcon,
  InformationCircleIcon,
  BulbIcon,
  Globe02Icon,
  GithubIcon,
  StarIcon,
  ExternalLinkIcon,
  ArrowRight01Icon,
  ChevronDownIcon,
  Copy01Icon,
  CopyCheckIcon,
  Download01Icon,
  Upload01Icon,
  Image01Icon,
  LockKeyIcon,
  Menu01Icon,
  ContainerIcon,
  FileCheckIcon,
  Money01Icon,
  Cancel01Icon,
  UserGroupIcon,
  Building01Icon,
} from "@hugeicons/core-free-icons";

interface IconProps {
  icon: IconSvgElement;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ icon, size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />;
}

export {
  BoltIcon, Key01Icon, Layers01Icon, CodeIcon, ReceiptTextIcon,
  Search01Icon, Camera01Icon, QrCode01Icon, QrCodeScanIcon,
  BookOpen01Icon, Shield01Icon, CheckmarkCircle01Icon, Alert01Icon,
  AlertCircleIcon, InformationCircleIcon, BulbIcon, Globe02Icon,
  GithubIcon, StarIcon, ExternalLinkIcon, ArrowRight01Icon,
  ChevronDownIcon, Copy01Icon, CopyCheckIcon, Download01Icon,
  Upload01Icon, Image01Icon, LockKeyIcon, Menu01Icon,
  ContainerIcon, FileCheckIcon, Money01Icon, Cancel01Icon,
};
