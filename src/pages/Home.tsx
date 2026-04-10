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
  const [activeFilters, setActiveFilters] = useState<{ location: boolean; price: boolean; availability: boolean }>({
    location: false,
    price: false,
    availability: false
  })

  const toggleFilter = (filter: 'location' | 'price' | 'availability') => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }))
  }

  // Re-sort trainers based on active filters
  useEffect(() => {
    if (trainers.length === 0) return

    let sortedTrainers = [...trainers]

    // Apply filters
    if (activeFilters.availability) {
      // Filter for only available trainers
      sortedTrainers = sortedTrainers.filter(t => t)
    }

    // Apply sorting
    if (activeFilters.price) {
      // Sort by price (lowest first)
      sortedTrainers.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0))
    } else if (activeFilters.location) {
      // Sort by rating as proxy for quality/relevance when filtering by location
      sortedTrainers.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    } else {
      // Default: sort by rating for Trending
      sortedTrainers.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }

    // Update trending (top 2 by rating)
    const trending = sortedTrainers.slice(0, 2)
    setTrendingTrainers(trending)

    // Update top coaches (top 2 by reviews or current sort)
    const topCoachesList = activeFilters.price
      ? sortedTrainers.slice(0, 2)
      : [...trainers].sort((a, b) => (b.total_reviews || 0) - (a.total_reviews || 0)).slice(0, 2)
    setTopCoaches(topCoachesList)
  }, [activeFilters, trainers])

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

  // Generate category background gradients
  const getCategoryGradient = (categoryId: number, categoryName: string): string => {
    const gradients: Record<string, string> = {
      'badminton': 'bg-gradient-to-br from-green-400 to-green-600',
      'tennis': 'bg-gradient-to-br from-blue-400 to-blue-600',
      'table tennis': 'bg-gradient-to-br from-orange-400 to-orange-600',
      'lawn tennis': 'bg-gradient-to-br from-blue-500 to-blue-700',
      'cooking': 'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'yoga': 'bg-gradient-to-br from-purple-400 to-purple-600',
      'fitness': 'bg-gradient-to-br from-red-400 to-red-600',
      'pilates': 'bg-gradient-to-br from-pink-400 to-pink-600',
      'dance': 'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'swimming': 'bg-gradient-to-br from-cyan-400 to-cyan-600',
    }

    const key = categoryName.toLowerCase().trim()
    if (gradients[key]) {
      return gradients[key]
    }

    // Default gradients based on category ID
    const defaultGradients = [
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'bg-gradient-to-br from-red-400 to-red-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
    ]

    return defaultGradients[categoryId % defaultGradients.length]
  }

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
      <section className="relative overflow-hidden bg-slate-900 min-h-[280px] lg:min-h-[350px]">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1600&h=900&fit=crop")',
            opacity: 0.35
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/85 via-slate-900/75 to-slate-900/70" />

        {/* Content */}
        <div className="relative container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 flex flex-col justify-center min-h-[280px] lg:min-h-[350px]">
          <div className="space-y-2 lg:space-y-3 max-w-4xl">
            {/* Main Heading */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-0">
                Find Your Perfect Trainer
              </h1>
              <p className="text-lg sm:text-xl text-white/90 mb-0">
                Discover certified trainers and book sessions that fit your schedule
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search for trainers or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/explore?search=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                className="w-full px-5 py-4 rounded-lg bg-white text-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
              />
              <button
                onClick={() => {
                  if (searchQuery.trim()) {
                    navigate(`/explore?search=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                className="absolute right-5 top-4 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => toggleFilter('location')} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors backdrop-blur-sm ${activeFilters.location ? 'bg-white text-slate-900' : 'bg-white/25 hover:bg-white/35 text-white'}`}>
                <MapPin className="w-5 h-5" />
                Location
              </button>
              <button onClick={() => toggleFilter('price')} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors backdrop-blur-sm ${activeFilters.price ? 'bg-white text-slate-900' : 'bg-white/25 hover:bg-white/35 text-white'}`}>
                💰 Price
              </button>
              <button onClick={() => toggleFilter('availability')} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors backdrop-blur-sm ${activeFilters.availability ? 'bg-white text-slate-900' : 'bg-white/25 hover:bg-white/35 text-white'}`}>
                👥 Availability
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trending in Nairobi Section */}
      <section className="py-2 lg:py-4 bg-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <section className="py-6 lg:py-8 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Popular Categories</h2>
          <p className="text-lg text-muted-foreground mb-10">Explore different training disciplines</p>

          {categoriesLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading categories...</div>
          ) : categories.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No categories available at the moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {categories.slice(0, 4).map((category) => (
                <Link key={category.id} to={`/explore?category=${category.id}`}>
                  <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer bg-white dark:bg-slate-800 border-0 overflow-hidden rounded-lg sm:rounded-xl">
                    <div className={`relative h-28 sm:h-36 lg:h-48 ${getCategoryGradient(category.id, category.name)} flex items-center justify-center overflow-hidden`}>
                      <div className="text-4xl sm:text-5xl lg:text-7xl drop-shadow-lg">
                        {category.icon || '🏋️'}
                      </div>
                    </div>
                    <CardContent className="p-2 sm:p-4 lg:p-6 text-center">
                      <h3 className="text-xs sm:text-base lg:text-lg font-bold text-foreground">{category.name}</h3>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Coaches This Week Section */}
      <section className="py-8 lg:py-10 bg-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
