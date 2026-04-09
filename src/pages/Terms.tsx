import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import Header from '@/components/Header'
import AuthLogo from '@/components/auth/AuthLogo'

const Terms: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header />
    
    <div className="flex-1 p-6">
      <div className="container max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-4">These terms govern your use of TrainerCoachConnect. By using the service you agree to these terms.</p>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Using the Service</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You are responsible for your account and for providing accurate information. Trainers must represent their qualifications truthfully.</p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Bookings and Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Bookings are agreements between clients and trainers. Payments processed through the platform are subject to the provider's terms. TrainerCoachConnect is not a party to the training agreement beyond facilitating bookings.</p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Limitations and Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">TrainerCoachConnect is provided "as is" and we disclaim liability to the fullest extent permitted by law. Review the full legal text before publishing.</p>
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

export default Terms
