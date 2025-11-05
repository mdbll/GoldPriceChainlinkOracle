"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      {...props}
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-600" />,
        error: <OctagonXIcon className="size-4 text-red-600" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        info: <InfoIcon className="size-4 text-blue-600" />,
        loading: <Loader2Icon className="size-4 animate-spin text-slate-500" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "font-medium border rounded-lg shadow-md px-4 py-3 flex items-center gap-3 w-auto",

          success:
            "bg-green-50 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200",

          error:
            "bg-red-50 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200",

          warning:
            "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200",

          info:
            "bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200",
        },
      }}
    />
  )
}
