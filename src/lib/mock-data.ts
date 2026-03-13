/**
 * Mock data provider for offline/fallback scenarios
 * Used when the actual API is unavailable
 */

export const mockData = {
  categories: [
    {
      id: 1,
      name: "Strength Training",
      icon: "💪",
      description: "Build muscle and increase strength"
    },
    {
      id: 2,
      name: "Cardio",
      icon: "🏃",
      description: "Improve cardiovascular fitness"
    },
    {
      id: 3,
      name: "Yoga",
      icon: "🧘",
      description: "Flexibility and mindfulness"
    },
    {
      id: 4,
      name: "HIIT",
      icon: "⚡",
      description: "High-intensity interval training"
    },
    {
      id: 5,
      name: "Boxing",
      icon: "🥊",
      description: "Combat training and fitness"
    },
    {
      id: 6,
      name: "Swimming",
      icon: "🏊",
      description: "Full-body aquatic training"
    }
  ],

  users: [],

  trainers: [
    {
      id: "trainer-1",
      user_id: "user-1",
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "+254700000000",
      user_type: "trainer",
      is_approved: 1,
      rating: 4.9,
      hourly_rate: 2500,
      bio: "Certified personal trainer with 5+ years experience",
      location: "Nairobi",
      disciplines: "Strength Training, HIIT"
    },
    {
      id: "trainer-2",
      user_id: "user-2",
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah@example.com",
      phone: "+254700000001",
      user_type: "trainer",
      is_approved: 1,
      rating: 4.8,
      hourly_rate: 2000,
      bio: "Yoga and flexibility specialist",
      location: "Nairobi",
      disciplines: "Yoga, Flexibility"
    },
    {
      id: "trainer-3",
      user_id: "user-3",
      first_name: "Mike",
      last_name: "Brown",
      email: "mike@example.com",
      phone: "+254700000002",
      user_type: "trainer",
      is_approved: 1,
      rating: 4.7,
      hourly_rate: 2200,
      bio: "Cardio and endurance coach",
      location: "Nairobi",
      disciplines: "Cardio, Boxing"
    }
  ],

  verificationDocuments: [
    {
      id: "doc-1",
      trainer_id: "user-1",
      full_name: "John Doe",
      document_type: "national_id",
      file_url: "https://via.placeholder.com/600x400?text=National+ID",
      status: "pending",
      uploaded_at: new Date(Date.now() - 3600000).toISOString(),
      user_type: "trainer"
    },
    {
      id: "doc-2",
      trainer_id: "user-2",
      full_name: "Sarah Johnson",
      document_type: "proof_of_residence",
      file_url: "https://via.placeholder.com/600x400?text=Proof+of+Residence",
      status: "pending",
      uploaded_at: new Date(Date.now() - 7200000).toISOString(),
      user_type: "trainer"
    },
    {
      id: "doc-3",
      trainer_id: "user-1",
      full_name: "John Doe",
      document_type: "certificate_of_good_conduct",
      file_url: "https://via.placeholder.com/600x400?text=Certificate",
      status: "approved",
      uploaded_at: new Date(Date.now() - 86400000).toISOString(),
      reviewed_at: new Date(Date.now() - 43200000).toISOString(),
      reviewed_by: "admin-1",
      user_type: "trainer"
    }
  ]
}

export function getMockResponse(action: string, payload?: Record<string, any>): { status: string; data?: any; message?: string } | null {
  switch (action) {
    case 'get_categories':
      return {
        status: 'success',
        data: mockData.categories
      }

    case 'get_users':
      return {
        status: 'success',
        data: mockData.users
      }

    case 'get_available_trainers':
      return {
        status: 'success',
        data: mockData.trainers
      }

    case 'trainers_by_category':
      return {
        status: 'success',
        data: mockData.trainers
      }

    case 'health_check':
      return {
        status: 'success',
        message: 'Server is running (mock)'
      }

    case 'verification_documents_list':
      return {
        status: 'success',
        data: mockData.verificationDocuments
      }

    default:
      return {
        status: 'success',
        data: []
      }
  }
}
