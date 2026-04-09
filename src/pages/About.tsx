import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Header from '@/components/Header'

const About: React.FC = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <div className="p-6">
      <div className="container max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">About TrainerCoachConnect</h1>
      <p className="text-muted-foreground mb-4">TrainerCoachConnect helps people find qualified fitness trainers nearby, book sessions, and manage payments. We focus on trust, convenience, and local discovery.</p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Our Mission</CardTitle>
          <CardDescription>Make fitness accessible</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">We believe everyone deserves access to quality coaching. Our platform connects clients with verified trainers and provides tools for bookings, payments, and session tracking.</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>What we offer</CardTitle>
          <CardDescription>Features</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
            <li>Search trainers by location, discipline, and availability.</li>
            <li>Secure payments with M-Pesa and other providers.</li>
            <li>In-app messaging and session management.</li>
            <li>Ratings, reviews and verified trainer profiles.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Our Team</CardTitle>
          <CardDescription>People behind the product</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">A small team of product builders, fitness enthusiasts and operators dedicated to building tools for trainers and clients. For partnership inquiries, contact support@trainercoachconnect.com.</p>
        </CardContent>
      </Card>

      <div className="mt-4">
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
      </div>
    </div>
  </div>
)

export default About
