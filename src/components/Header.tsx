import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AuthLogo from '@/components/auth/AuthLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/button'
import WaitlistDialog from '@/components/WaitlistDialog'

const NavLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link to={to} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
    {children}
  </Link>
)

const Header: React.FC = () => {
  const [open, setOpen] = React.useState(false)
  const [waitlistOpen, setWaitlistOpen] = React.useState(false)
  const { user, userType, signOut, loading } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
        <div className="flex h-48 sm:h-64 lg:h-80 items-center justify-between">
          <div className="flex items-center gap-6 lg:gap-8">
            <AuthLogo compact containerClassName="h-48 w-48 sm:h-64 sm:w-64 lg:h-80 lg:w-80" className="h-48 sm:h-64 lg:h-80" />
            <nav className="hidden md:flex items-center gap-8">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/contact">Contact</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="md:hidden">
              <button
                aria-label="menu"
                onClick={() => setOpen(v => !v)}
                className="p-2 rounded-md hover:bg-accent transition-colors text-base font-medium"
              >
                {open ? 'Close' : 'Menu'}
              </button>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {!user && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setWaitlistOpen(true)}
                    className="text-trainer-primary border-trainer-primary"
                  >
                    Join Waitlist
                  </Button>
                  <Link to="/signin">
                    <Button variant="ghost">Sign In</Button>
                  </Link>
                  <Link to="/signup">
                    <Button>Get Started</Button>
                  </Link>
                </>
              )}
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await signOut()
                      navigate('/')
                    }}
                  >
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden border-t border-border py-6 px-2">
            <nav className="flex flex-col gap-2">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/contact">Contact</NavLink>
              <div className="border-t border-border pt-4 mt-2 space-y-2">
                {!user && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setWaitlistOpen(true)}
                      className="w-full text-trainer-primary border-trainer-primary"
                    >
                      Join Waitlist
                    </Button>
                    <Link to="/signin" className="block">
                      <Button variant="ghost" className="w-full justify-center">Sign In</Button>
                    </Link>
                    <Link to="/signup" className="block">
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </>
                )}
                {user && (
                  <>
                    <div className="text-sm text-muted-foreground px-2">{user.email}</div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        await signOut()
                        navigate('/')
                        setOpen(false)
                      }}
                    >
                      Sign Out
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Waitlist Dialog */}
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </header>
  )
}

export default Header
