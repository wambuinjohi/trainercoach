import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Header from '@/components/Header'
import AuthLogo from '@/components/auth/AuthLogo'
import TrendingTrainers from '@/components/home/TrendingTrainers'
import TopCoaches from '@/components/home/TopCoaches'
import {
  CheckCircle2,
  MapPin,
  Shield,
  MessageSquare,
  Star,
  Dumbbell,
  Calendar,
  TrendingUp,
  Users,
  Award,
  ArrowRight
} from 'lucide-react'
import * as apiService from '@/lib/api-service'

interface Category {
  id: number
  name: string
  icon?: string
  description?: string
}

interface Trainer {
  id: string
  name: string
  hourlyRate: number
  rating: number
  image_url?: string
  bio?: string
  experience_level?: string
  total_reviews?: number
  categoryIds?: number[]
  verified?: boolean
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [trendingTrainers, setTrendingTrainers] = useState<Trainer[]>([])
  const [topCoaches, setTopCoaches] = useState<Trainer[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [trainersLoading, setTrainersLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const handleBookNow = (trainer: Trainer) => {
    // Navigate to signin - user must authenticate to book
    navigate('/signin')
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('[Home] Loading categories and trainers...')

        // Load categories
        const categoriesResponse = await apiService.getCategories()
        console.log('[Home] Categories response:', categoriesResponse)

        // Handle different response formats from API or mock data
        let categories: Category[] = []
        if (Array.isArray(categoriesResponse)) {
          categories = categoriesResponse
        } else if (categoriesResponse?.data && Array.isArray(categoriesResponse.data)) {
          categories = categoriesResponse.data
        }

        if (categories.length > 0) {
          setCategories(categories)
        }

        // Load trainers
        console.log('[Home] Loading trainers...')
        const trainersResponse = await apiService.getAvailableTrainers()
        console.log('[Home] Trainers response:', trainersResponse)

        let trainersData: Trainer[] = []
        if (Array.isArray(trainersResponse)) {
          trainersData = trainersResponse
        } else if (trainersResponse?.data && Array.isArray(trainersResponse.data)) {
          // Fetch category information for each trainer
          const enrichedTrainers = await Promise.all(
            trainersResponse.data.map(async (trainer: any) => {
              try {
                const trainerCategoriesData = await apiService.getTrainerCategories(trainer.user_id)
                const categoryIds = trainerCategoriesData?.data?.map((cat: any) => cat.category_id || cat.cat_id) || []

                return {
                  id: trainer.user_id,
                  name: trainer.full_name || 'Trainer',
                  hourlyRate: trainer.hourly_rate || 0,
                  rating: trainer.rating || 0,
                  image_url: trainer.profile_image || trainer.profile_image_url || trainer.image_url || null,
                  bio: trainer.bio || null,
                  experience_level: trainer.experience_level || null,
                  total_reviews: trainer.total_reviews || 0,
                  categoryIds,
                  verified: trainer.verified || false,
                }
              } catch (err) {
                console.warn('Failed to fetch categories for trainer', trainer.user_id)
                return {
                  id: trainer.user_id,
                  name: trainer.full_name || 'Trainer',
                  hourlyRate: trainer.hourly_rate || 0,
                  rating: trainer.rating || 0,
                  image_url: trainer.profile_image || trainer.profile_image_url || trainer.image_url || null,
                  bio: trainer.bio || null,
                  experience_level: trainer.experience_level || null,
                  total_reviews: trainer.total_reviews || 0,
                  categoryIds: [],
                  verified: trainer.verified || false,
                }
              }
            })
          )
          trainersData = enrichedTrainers
        }

        if (trainersData.length > 0) {
          setTrainers(trainersData)

          // Sort for Trending section: by rating (highest first)
          const trending = [...trainersData]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 2)
          setTrendingTrainers(trending)

          // Sort for Top Coaches section: by review count (most reviews first)
          const topCoachesList = [...trainersData]
            .sort((a, b) => (b.total_reviews || 0) - (a.total_reviews || 0))
            .slice(0, 2)
          setTopCoaches(topCoachesList)
        }
      } catch (err) {
        console.error('[Home] Failed to load data:', err)
        setLoadError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setCategoriesLoading(false)
        setTrainersLoading(false)
      }
    }
    loadData()
  }, [])

  const features = [
    {
      icon: <Shield className="w-8 h-8 text-trainer-primary" />,
      title: "Verified Trainers",
      description: "All trainers are verified with credentials and background checks for your safety and confidence."
    },
    {
      icon: <MapPin className="w-8 h-8 text-trainer-primary" />,
      title: "Local Matches",
      description: "Find expert trainers near you using smart location-based matching and filters."
    },
    {
      icon: <CheckCircle2 className="w-8 h-8 text-trainer-primary" />,
      title: "Secure Payments",
      description: "M-Pesa and secure payment processing with buyer protection and transparent pricing."
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-trainer-primary" />,
      title: "Direct Communication",
      description: "Chat with trainers instantly to discuss goals, availability, and customize your program."
    },
    {
      icon: <Calendar className="w-8 h-8 text-trainer-primary" />,
      title: "Easy Scheduling",
      description: "Book sessions with real-time availability and automated reminders."
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-trainer-primary" />,
      title: "Track Progress",
      description: "Monitor your fitness journey with built-in progress tracking and milestone celebrations."
    }
  ]

  const stats = [
    { icon: <Users className="w-6 h-6" />, value: "5,000+", label: "Active Users" },
    { icon: <Dumbbell className="w-6 h-6" />, value: "500+", label: "Certified Trainers" },
    { icon: <Star className="w-6 h-6" />, value: "4.9/5", label: "Average Rating" },
    { icon: <Award className="w-6 h-6" />, value: "50K+", label: "Sessions Completed" }
  ]

  const testimonials = [
    {
      name: "Jane C.",
      role: "Fitness Enthusiast",
      content: "Found a great trainer in my neighbourhood. The booking process was seamless and the results speak for themselves!",
      rating: 5
    },
    {
      name: "Paul M.",
      role: "Busy Professional",
      content: "The platform made it so easy to compare rates and availability. My trainer understands my schedule perfectly.",
      rating: 5
    },
    {
      name: "Asha K.",
      role: "Marathon Runner",
      content: "Detailed trainer profiles helped me find the perfect coach for my marathon training. Couldn't be happier!",
      rating: 5
    }
  ]

  console.log('[Home] Rendering Home page')

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-trainer-primary/10 via-transparent to-trainer-accent/10" />
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-trainer-primary/10 text-trainer-primary text-sm font-medium">
                <Star className="w-4 h-4 fill-current" />
                Trusted by 5,000+ fitness enthusiasts
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                FIND YOUR COACH.{' '}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  FIND YOUR FREEDOM.
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">
                Connect with certified trainers in your area. Book sessions, track progress, and achieve your fitness goals with personalized guidance.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 transition-opacity text-white shadow-glow">
                    Start Your Journey
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Explore Trainers
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8">
                {stats.map((stat, index) => (
                  <div key={index} className="space-y-2">
                    <div className="text-trainer-primary">{stat.icon}</div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Image Grid */}
            <div className="relative lg:h-[600px]">
              <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-4">
                  <Card className="overflow-hidden h-48 lg:h-64 shadow-card hover:shadow-glow transition-shadow">
                    <img 
                      src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=800&fit=crop" 
                      alt="Personal training session"
                      className="w-full h-full object-cover"
                    />
                  </Card>
                  <Card className="overflow-hidden h-32 lg:h-48 shadow-card hover:shadow-glow transition-shadow">
                    <img 
                      src="https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=600&h=600&fit=crop" 
                      alt="Outdoor workout"
                      className="w-full h-full object-cover"
                    />
                  </Card>
                </div>
                <div className="space-y-4 pt-8">
                  <Card className="overflow-hidden h-32 lg:h-48 shadow-card hover:shadow-glow transition-shadow">
                    <img 
                      src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=600&fit=crop" 
                      alt="Gym training"
                      className="w-full h-full object-cover"
                    />
                  </Card>
                  <Card className="overflow-hidden h-48 lg:h-64 shadow-card hover:shadow-glow transition-shadow">
                    <img 
                      src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=800&fit=crop" 
                      alt="Group fitness"
                      className="w-full h-full object-cover"
                    />
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Trainers Section */}
      <TrendingTrainers
        trainers={trendingTrainers}
        categories={categories}
        isLoading={trainersLoading}
        onBookNow={handleBookNow}
      />

      {/* Features Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose TrainerCoachConnect?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to find, book, and train with the best fitness professionals
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="p-6 hover:shadow-glow transition-all duration-300 hover:-translate-y-1 bg-card"
              >
                <CardContent className="p-0 space-y-4">
                  <div className="w-14 h-14 rounded-lg bg-trainer-primary/10 flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 lg:py-32">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Find Trainers by Service
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Browse certified trainers specialized in various fitness disciplines
            </p>
          </div>

          {categoriesLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading categories...</div>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No categories available at the moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
              {categories.slice(0, 4).map((category) => (
                <Link key={category.id} to={`/explore?category=${category.id}`}>
                  <Card className="h-full hover:shadow-glow transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-white dark:bg-slate-800 border-0 overflow-hidden">
                    <div className="relative h-40 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden">
                      <div className="text-6xl">
                        {category.icon || '🏋️'}
                      </div>
                    </div>
                    <CardContent className="p-6 text-center">
                      <h3 className="text-lg font-semibold text-foreground mb-1">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{category.description}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Coaches Section */}
      <TopCoaches
        trainers={topCoaches}
        categories={categories}
        isLoading={trainersLoading}
      />

      {/* Testimonials Section */}
      <section className="py-20 lg:py-32">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What Our Community Says
            </h2>
            <p className="text-lg text-muted-foreground">
              Real stories from real people achieving their fitness goals
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 bg-card hover:shadow-glow transition-shadow">
                <CardContent className="p-0 space-y-4">
                  <div className="flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-trainer-primary text-trainer-primary" />
                    ))}
                  </div>
                  <p className="text-foreground">{testimonial.content}</p>
                  <div className="pt-4 border-t border-border">
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Fitness Journey?
          </h2>
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied clients who've found their perfect trainer match. Start your transformation today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Create Free Account
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/20">
                Browse Trainers
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
}

export default Home
