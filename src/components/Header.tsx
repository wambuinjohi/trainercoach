import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import AuthLogo from '@/components/auth/AuthLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { Button } from '@/components/ui/button'
import WaitlistDialog from '@/components/WaitlistDialog'
import { Menu, X } from 'lucide-react'

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

  const closeMenu = () => setOpen(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <style>{`
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOutToLeft {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .menu-slide-in {
          animation: slideInFromLeft 0.3s ease-out forwards;
        }

        .menu-slide-out {
          animation: slideOutToLeft 0.3s ease-in forwards;
        }

        .overlay-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .overlay-fade-out {
          animation: fadeOut 0.3s ease-in forwards;
        }
      `}</style>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
        <div className="flex h-16 sm:h-20 lg:h-24 items-center justify-between">
          <div className="flex items-center gap-4 lg:gap-8">
            <AuthLogo compact containerClassName="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24" className="h-16 sm:h-20 lg:h-24" />
            <nav className="hidden md:flex items-center gap-8">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/about">About</NavLink>
              <NavLink to="/contact">Contact</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
            <ThemeToggle />
            <div className="md:hidden">
              <button
                aria-label="menu"
                onClick={() => setOpen(v => !v)}
                className="p-2 rounded-md hover:bg-accent transition-colors"
              >
                {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
            <div className="hidden md:flex items-center gap-3 lg:gap-4">
              {!user && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setWaitlistOpen(true)}
                    size="sm"
                    className="text-trainer-primary border-trainer-primary"
                  >
                    Join Waitlist
                  </Button>
                  <Link to="/signin">
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </Link>
                  <Link to="/signup">
                    <Button size="sm">Get Started</Button>
                  </Link>
                </>
              )}
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-xs lg:text-sm text-muted-foreground truncate max-w-[100px]">{user.email}</span>
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
      </div>

      {/* Mobile Menu Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden overlay-fade-in z-40"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Menu Slide Panel */}
      {open && (
        <div className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-background border-r border-border md:hidden menu-slide-in z-50 overflow-y-auto">
          <nav className="flex flex-col gap-2 p-4">
            <Link
              to="/"
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
              onClick={closeMenu}
            >
              Home
            </Link>
            <Link
              to="/explore"
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
              onClick={closeMenu}
            >
              Explore
            </Link>
            <Link
              to="/about"
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
              onClick={closeMenu}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
              onClick={closeMenu}
            >
              Contact
            </Link>

            <div className="border-t border-border pt-4 mt-2 space-y-2">
              {!user && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWaitlistOpen(true)
                      closeMenu()
                    }}
                    className="w-full text-trainer-primary border-trainer-primary text-sm"
                  >
                    Join Waitlist
                  </Button>
                  <Link to="/signin" className="block" onClick={closeMenu}>
                    <Button variant="ghost" className="w-full justify-center text-sm">Sign In</Button>
                  </Link>
                  <Link to="/signup" className="block" onClick={closeMenu}>
                    <Button className="w-full text-sm">Get Started</Button>
                  </Link>
                </>
              )}
              {user && (
                <>
                  <div className="text-xs text-muted-foreground px-4 py-2 break-all">{user.email}</div>
                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={async () => {
                      await signOut()
                      navigate('/')
                      closeMenu()
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

      {/* Waitlist Dialog */}
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </header>
  )
}

export default Header
