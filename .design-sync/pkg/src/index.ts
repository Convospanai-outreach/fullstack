// Virtual package entry for design-sync — re-exports the real CraftMyFunnel
// component source files. No component logic lives here; this only wires
// the sync's build (path aliases, next.js/Clerk stubs) to the repo's code.

// ---- Primitives (apps/web/src/components/ui) ----
export { CommandPalette } from "@/components/ui/CommandPalette";
export { GlassCard } from "@/components/ui/GlassCard";
export { Input } from "@/components/ui/Input";
export { Modal } from "@/components/ui/Modal";
export { NotificationBell } from "@/components/ui/NotificationBell";
export { PrimaryButton } from "@/components/ui/PrimaryButton";
export { Progress } from "@/components/ui/Progress";
export { SectionHeader } from "@/components/ui/SectionHeader";
export { Skeleton } from "@/components/ui/Skeleton";
export { StatBlock } from "@/components/ui/StatBlock";
export { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
export { Badge, badgeVariants } from "@/components/ui/badge";
export { Button, buttonVariants } from "@/components/ui/button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "@/components/ui/dropdown-menu";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
export { Textarea } from "@/components/ui/textarea";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ---- Layout / marketing (apps/web/src/components, top level) ----
export { default as FeatureGrid } from "@/components/FeatureGrid";
export { default as Footer } from "@/components/Footer";
export { default as MarketingGlassCard } from "@/components/GlassCard";
export { default as GlowButton } from "@/components/GlowButton";
export { default as Header } from "@/components/Header";
export { HeaderBanner } from "@/components/HeaderBanner";
export { MobileMenu } from "@/components/MobileMenu";
export { default as Nav } from "@/components/Nav";
export { NavBar } from "@/components/NavBar";
export { NavDropdown } from "@/components/NavDropdown";
export type { NavItem, NavDropdownProps } from "@/components/NavDropdown";
export { default as SectionTitle } from "@/components/SectionTitle";
