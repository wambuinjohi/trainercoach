import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Header from '@/components/Header'
import AuthLogo from '@/components/auth/AuthLogo'

const Privacy: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header />
    
    <div className="flex-1 p-6">
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-4">This policy explains how TrainerCoachConnect collects, uses and stores your personal information.</p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Information we collect</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Account information: email, name, phone number.</li>
              <li>Profile details: location, bio, disciplines and service area for trainers.</li>
              <li>Transactional information: bookings, payments and receipts.</li>
              <li>Usage information: device and app usage data to improve the service.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>How we use data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">We use your data to enable core functionality: creating accounts, finding trainers near you, processing bookings and payments, and sending notifications about your sessions. We may also use anonymized data for analytics and improvement.</p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Your choices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You can edit your profile and location in the app. To request deletion of your account, contact support@trainercoachconnect.com.</p>
          </CardContent>
        </Card>

        <div className="mt-4">
          <Link to="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>

    {/* Footer */}
    <footer className="border-t border-border bg-card">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <AuthLogo compact containerClassName="h-32 w-32" className="h-32" />
            <p className="text-sm text-muted-foreground">
              Connecting fitness enthusiasts with certified trainers for personalized training experiences.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Platform</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link to="/explore" className="block hover:text-primary transition-colors">Find Trainers</Link>
              <Link to="/about" className="block hover:text-primary transition-colors">About Us</Link>
              <Link to="/contact" className="block hover:text-primary transition-colors">Contact</Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link to="/privacy" className="block hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="block hover:text-primary transition-colors">Terms of Service</Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Get Started</h3>
            <div className="space-y-2">
              <Link to="/signup">
                <Button className="w-full" size="sm">Sign Up</Button>
              </Link>
              <Link to="/signin">
                <Button variant="outline" className="w-full" size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} TrainerCoachConnect. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  </div>
)

export default Privacy
