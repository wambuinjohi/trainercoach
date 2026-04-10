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
  ArrowRight,
  Search
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
  const [searchQuery, setSearchQuery] = useState('')

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

      {/* Hero Section with Background Image */}
      <section className="relative overflow-hidden bg-slate-900 h-auto lg:min-h-[600px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&h=800&fit=crop")',
            opacity: 0.4
          }}
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/70 to-slate-900/60" />

        {/* Content */}
        <div className="relative container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="space-y-6 lg:space-y-8 max-w-3xl">
            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Find Your Perfect Trainer
            </h1>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search for trainers or categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-trainer-primary"
                />
                <Search className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              <Link to="/explore">
                <Button className="w-full sm:w-auto bg-white text-slate-900 hover:bg-gray-100 font-semibold px-6">
                  Filters ▼
                </Button>
              </Link>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors">
                <MapPin className="w-4 h-4" />
                Location
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors">
                💰 Price
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors">
                👥 Availability
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trending in Nairobi Section */}
      <section className="py-12 lg:py-16 bg-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold mb-8">Trending in Nairobi</h2>

          {trainersLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading trainers...</div>
          ) : trendingTrainers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No trainers available at the moment
              </CardContent>
            </Card>
          ) : (
            <TrendingTrainers
              trainers={trendingTrainers}
              categories={categories}
              isLoading={trainersLoading}
              onBookNow={handleBookNow}
            />
          )}
        </div>
      </section>

      {/* Popular Categories Section */}
      <section className="py-12 lg:py-16 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold mb-8">Popular Categories</h2>

          {categoriesLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading categories...</div>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No categories available at the moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {categories.slice(0, 4).map((category) => (
                <Link key={category.id} to={`/explore?category=${category.id}`}>
                  <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-white dark:bg-slate-800 border-0 overflow-hidden">
                    <div className="relative h-32 lg:h-40 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center overflow-hidden">
                      <div className="text-5xl lg:text-6xl">
                        {category.icon || '🏋️'}
                      </div>
                    </div>
                    <CardContent className="p-4 lg:p-6 text-center">
                      <h3 className="text-base lg:text-lg font-semibold text-foreground">{category.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Coaches This Week Section */}
      <section className="py-12 lg:py-16 bg-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl lg:text-3xl font-bold mb-8">Top Coaches This Week</h2>

          {trainersLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading coaches...</div>
          ) : topCoaches.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No coaches available at the moment
              </CardContent>
            </Card>
          ) : (
            <TopCoaches
              trainers={topCoaches}
              categories={categories}
              isLoading={trainersLoading}
            />
          )}
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
