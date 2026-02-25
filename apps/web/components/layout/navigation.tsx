'use client';

import { type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	Calculator,
	TrendingUp,
	Variable,
	Menu,
	Grid3x3,
	Square,
	Ruler,
	Sparkles,
	Activity,
	Trophy,
	Wind,
	Flame,
	Network,
	Brain,
	LogIn,
	LogOut,
	Settings,
	User,
	BarChart2,
	Infinity,
	BookOpen,
	MessageSquare,
	Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from './theme-toggle';
import { CommandPalette } from './command-palette';
import { useSession, signIn, signOut } from '@/lib/auth/hooks';

interface NavLink {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	description: string;
}

const coreNavigationLinks: NavLink[] = [
	{
		href: '/',
		label: 'Calculator',
		icon: Calculator,
		description: 'Scientific calculator with history',
	},
	{
		href: '/plot',
		label: 'Plot',
		icon: TrendingUp,
		description: '2D and 3D function plotting',
	},
	{
		href: '/symbolic',
		label: 'Symbolic',
		icon: Variable,
		description: 'Differentiation and integration',
	},
	{
		href: '/matrix',
		label: 'Matrix',
		icon: Grid3x3,
		description: 'Linear algebra operations',
	},
	{
		href: '/solver',
		label: 'Solver',
		icon: Square,
		description: 'Equation solving',
	},
	{
		href: '/units',
		label: 'Units',
		icon: Ruler,
		description: 'Unit conversion',
	},
	{
		href: '/stats',
		label: 'Stats',
		icon: BarChart2,
		description: 'Descriptive statistics and regression',
	},
	{
		href: '/complex',
		label: 'Complex',
		icon: Infinity,
		description: 'Complex number arithmetic and visualization',
	},
	{
		href: '/worksheet',
		label: 'Worksheet',
		icon: BookOpen,
		description: 'Jupyter-like math notebook with plots',
	},
	{
		href: '/forum',
		label: 'Forum',
		icon: MessageSquare,
		description: 'Community discussions and Q&A',
	},
];

const algorithmLinks: NavLink[] = [
	{
		href: '/algorithms',
		label: 'Overview',
		icon: Sparkles,
		description: 'Algorithm hub and categories',
	},
	{
		href: '/fourier',
		label: 'Fourier',
		icon: Activity,
		description: 'FFT and frequency analysis',
	},
	{
		href: '/game-theory',
		label: 'Game Theory',
		icon: Trophy,
		description: 'Nash equilibrium',
	},
	{
		href: '/chaos',
		label: 'Chaos',
		icon: Wind,
		description: 'Lorenz attractors',
	},
	{
		href: '/pde',
		label: 'PDE',
		icon: Flame,
		description: 'Partial differential equations',
	},
	{
		href: '/pde/3d',
		label: 'PDE 3D',
		icon: Box,
		description: '3D PDE solver with isosurface visualization',
	},
	{
		href: '/solver/ode',
		label: 'ODE',
		icon: Activity,
		description: 'ODE solver with phase plane',
	},
	{
		href: '/graphs-full',
		label: 'Graphs',
		icon: Network,
		description: 'Graph algorithms',
	},
	{
		href: '/ml-algorithms',
		label: 'ML',
		icon: Brain,
		description: 'Machine learning',
	},
];

const algorithmPaths = [
	'/algorithms',
	'/fourier',
	'/game-theory',
	'/chaos',
	'/pde',
	'/pde/3d',
	'/solver/ode',
	'/graphs-full',
	'/ml-algorithms',
];

function UserAvatar({
	name,
	image,
}: {
	name?: string;
	image?: string;
}) {
	if (image) {
		return (
			<img
				src={image}
				alt={name || 'User avatar'}
				className="h-7 w-7 rounded-full ring-2 ring-border/50"
				referrerPolicy="no-referrer"
			/>
		);
	}

	const initials = name
		? name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: '?';

	return (
		<div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground ring-2 ring-border/50">
			{initials}
		</div>
	);
}

export function Navigation() {
	const pathname = usePathname();
	const { session, status } = useSession();

	const isLinkActive = (href: string) => {
		if (href === '/') return pathname === '/';
		return pathname.startsWith(href);
	};

	const isAlgorithmActive = algorithmPaths.some((p) =>
		pathname.startsWith(p),
	);

	return (
		<nav
			className="sticky top-0 z-50 w-full glass-heavy shadow-sm"
			aria-label="Main navigation"
		>
			{/* Subtle gradient border at bottom */}
			<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

			<div className="container flex h-14 items-center min-w-0">
				{/* Logo */}
				<div className="mr-4 flex shrink-0">
					<Link
						href="/"
						className="mr-6 flex items-center gap-2.5 transition-all duration-300 hover:opacity-80 group"
						aria-label="NextCalc Pro - Home"
					>
						<div className="relative">
							<Calculator
								className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
								aria-hidden="true"
							/>
							<div className="absolute -inset-1 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
						</div>
						<span className="hidden font-bold sm:inline-block bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent bg-[length:200%_auto] transition-all duration-500 group-hover:bg-[position:100%_50%]">
							NextCalc Pro
						</span>
					</Link>
				</div>

				{/* Desktop Navigation */}
				<div className="hidden md:flex md:flex-1 md:items-center md:gap-1 md:text-sm md:font-medium min-w-0 overflow-hidden">
					{coreNavigationLinks.map((link) => {
						const Icon = link.icon;
						const isActive = isLinkActive(link.href);

						return (
							<Link
								key={link.href}
								href={link.href}
								className={cn(
									'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap',
									isActive
										? 'text-primary-foreground bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20'
										: 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
								)}
								aria-label={`${link.label} - ${link.description}`}
								aria-current={isActive ? 'page' : undefined}
							>
								<Icon
									className={cn(
										'h-3.5 w-3.5 transition-transform duration-200',
										!isActive && 'group-hover:scale-110',
									)}
									aria-hidden="true"
								/>
								{link.label}
							</Link>
						);
					})}

					{/* Algorithms dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className={cn(
									'flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 relative group whitespace-nowrap',
									'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
									isAlgorithmActive
										? 'text-primary-foreground bg-gradient-to-r from-calculator-special to-primary shadow-md shadow-primary/20'
										: 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
								)}
								aria-label="Algorithms menu"
							>
								<Sparkles
									className={cn(
										'h-3.5 w-3.5 transition-transform duration-200',
										!isAlgorithmActive &&
											'group-hover:scale-110 group-hover:rotate-12',
									)}
									aria-hidden="true"
								/>
								Algorithms
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-64 glass-heavy border-border/50"
						>
							<DropdownMenuItem asChild>
								<Link
									href="/algorithms"
									className={cn(
										'flex items-center gap-3 rounded-lg',
										pathname === '/algorithms' && 'bg-primary/10 text-primary',
									)}
								>
									<Sparkles className="h-4 w-4" aria-hidden="true" />
									<div className="flex flex-col">
										<span className="font-medium">All Algorithms</span>
										<span className="text-xs text-muted-foreground">
											Browse all visualizations
										</span>
									</div>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{algorithmLinks.filter(l => l.href !== '/algorithms').map((link) => {
								const Icon = link.icon;
								const isActive = isLinkActive(link.href);

								return (
									<DropdownMenuItem key={link.href} asChild>
										<Link
											href={link.href}
											className={cn(
												'flex items-center gap-3 rounded-lg',
												isActive && 'bg-primary/10 text-primary',
											)}
											aria-current={isActive ? 'page' : undefined}
										>
											<Icon className="h-4 w-4" aria-hidden="true" />
											<div className="flex flex-col">
												<span className="font-medium">{link.label}</span>
												<span className="text-xs text-muted-foreground">
													{link.description}
												</span>
											</div>
										</Link>
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Mobile Navigation */}
				<div className="flex flex-1 items-center justify-end md:hidden">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Open navigation menu"
							>
								<Menu className="h-5 w-5" aria-hidden="true" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-56 glass-heavy border-border/50"
						>
							{coreNavigationLinks.map((link) => {
								const Icon = link.icon;
								const isActive = isLinkActive(link.href);

								return (
									<DropdownMenuItem key={link.href} asChild>
										<Link
											href={link.href}
											className={cn(
												'flex items-center gap-3 rounded-lg',
												isActive && 'bg-primary/10 text-primary',
											)}
											aria-current={isActive ? 'page' : undefined}
										>
											<Icon className="h-4 w-4" aria-hidden="true" />
											<div className="flex flex-col">
												<span className="font-medium">{link.label}</span>
												<span className="text-xs text-muted-foreground">
													{link.description}
												</span>
											</div>
										</Link>
									</DropdownMenuItem>
								);
							})}

							{/* Divider */}
							<div className="my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

							{algorithmLinks.map((link) => {
								const Icon = link.icon;
								const isActive = isLinkActive(link.href);

								return (
									<DropdownMenuItem key={link.href} asChild>
										<Link
											href={link.href}
											className={cn(
												'flex items-center gap-3 rounded-lg',
												isActive && 'bg-primary/10 text-primary',
											)}
											aria-current={isActive ? 'page' : undefined}
										>
											<Icon className="h-4 w-4" aria-hidden="true" />
											<div className="flex flex-col">
												<span className="font-medium">{link.label}</span>
												<span className="text-xs text-muted-foreground">
													{link.description}
												</span>
											</div>
										</Link>
									</DropdownMenuItem>
								);
							})}

							{/* Settings link in mobile menu */}
							<div className="my-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
							<DropdownMenuItem asChild>
								<Link
									href="/settings"
									className={cn(
										'flex items-center gap-3 rounded-lg',
										pathname === '/settings' && 'bg-primary/10 text-primary',
									)}
									aria-current={pathname === '/settings' ? 'page' : undefined}
								>
									<Settings className="h-4 w-4" aria-hidden="true" />
									<div className="flex flex-col">
										<span className="font-medium">Settings</span>
										<span className="text-xs text-muted-foreground">
											Profile, appearance, defaults
										</span>
									</div>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Command palette — trigger button (desktop) + global Ctrl+K dialog */}
				<CommandPalette className="mx-3 shrink-0" />

				{/* Right side: Theme toggle + Auth */}
				<div className="flex items-center gap-2 ml-auto shrink-0">
					<ThemeToggle />

					{/* Auth state */}
					{status === 'loading' ? (
						<div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
					) : status === 'authenticated' && session ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
									aria-label="User menu"
								>
									<UserAvatar
										{...(session.user.name ? { name: session.user.name } : {})}
										{...(session.user.image ? { image: session.user.image } : {})}
									/>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-56 glass-heavy border-border/50"
							>
								<div className="px-2 py-1.5 min-w-0 overflow-hidden">
									<p className="text-sm font-medium truncate">{session.user.name}</p>
									<p className="text-xs text-muted-foreground truncate">
										{session.user.email}
									</p>
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link
										href="/profile"
										className="flex items-center gap-2"
									>
										<User className="h-4 w-4" aria-hidden="true" />
										Profile
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link
										href="/settings"
										className="flex items-center gap-2"
									>
										<Settings className="h-4 w-4" aria-hidden="true" />
										Settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<button
										type="button"
										className="flex w-full items-center gap-2 text-destructive"
										onClick={() => signOut('/')}
									>
										<LogOut className="h-4 w-4" aria-hidden="true" />
										Sign out
									</button>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								asChild
								aria-label="Settings"
								className="text-muted-foreground hover:text-foreground"
							>
								<Link href="/settings">
									<Settings className="h-4 w-4" aria-hidden="true" />
								</Link>
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="gap-1.5 text-muted-foreground hover:text-foreground"
								onClick={() => signIn()}
							>
								<LogIn className="h-4 w-4" aria-hidden="true" />
								<span className="hidden sm:inline">Sign in</span>
							</Button>
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}
