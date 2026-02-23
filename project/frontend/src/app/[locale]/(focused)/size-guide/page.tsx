import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Ruler, Info } from 'lucide-react'

interface SizeGuidePageProps {
  params: Promise<{ locale: string }>
}

// Server Component - generates metadata for SEO
export async function generateMetadata({ params }: SizeGuidePageProps): Promise<Metadata> {
  const { locale } = await params

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://podai.com'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'POD AI'

  const title = `Size Guide - ${siteName}`
  const description = 'Find the perfect fit with our comprehensive size guide for apparel, accessories, and home decor products.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${locale}/size-guide`,
      siteName,
      locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/size-guide`,
      languages: {
        'en': `${baseUrl}/en/size-guide`,
        'es': `${baseUrl}/es/size-guide`,
        'de': `${baseUrl}/de/size-guide`,
      },
    },
  }
}

export default async function SizeGuidePage({ params }: SizeGuidePageProps) {
  const { locale } = await params

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Ruler className="size-8 text-primary" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Size Guide</h1>
        <p className="text-lg text-muted-foreground">
          Find your perfect fit with our detailed size charts
        </p>
      </div>

      {/* Measurement tips */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Info className="mt-1 size-5 text-primary" />
            <div>
              <CardTitle>How to Measure</CardTitle>
              <CardDescription className="mt-2">
                For the most accurate measurements, use a soft measuring tape and measure over bare skin or light clothing.
                Keep the tape snug but not tight, and make sure it's parallel to the floor.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-12">
        {/* T-Shirts & Tops */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">T-Shirts & Tops</CardTitle>
            <CardDescription>Unisex sizing - measurements in inches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Chest Width</TableHead>
                    <TableHead>Body Length</TableHead>
                    <TableHead>Sleeve Length</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">XS</TableCell>
                    <TableCell>16.5</TableCell>
                    <TableCell>27</TableCell>
                    <TableCell>8.25</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">S</TableCell>
                    <TableCell>18</TableCell>
                    <TableCell>28</TableCell>
                    <TableCell>8.62</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">M</TableCell>
                    <TableCell>20</TableCell>
                    <TableCell>29</TableCell>
                    <TableCell>9</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">L</TableCell>
                    <TableCell>22</TableCell>
                    <TableCell>30</TableCell>
                    <TableCell>9.37</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">XL</TableCell>
                    <TableCell>24</TableCell>
                    <TableCell>31</TableCell>
                    <TableCell>9.75</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">2XL</TableCell>
                    <TableCell>26</TableCell>
                    <TableCell>32</TableCell>
                    <TableCell>10.12</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">3XL</TableCell>
                    <TableCell>28</TableCell>
                    <TableCell>33</TableCell>
                    <TableCell>10.5</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Hoodies & Sweatshirts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Hoodies & Sweatshirts</CardTitle>
            <CardDescription>Unisex sizing - measurements in inches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Chest Width</TableHead>
                    <TableHead>Body Length</TableHead>
                    <TableHead>Sleeve Length</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">S</TableCell>
                    <TableCell>20</TableCell>
                    <TableCell>27</TableCell>
                    <TableCell>33.5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">M</TableCell>
                    <TableCell>21</TableCell>
                    <TableCell>28</TableCell>
                    <TableCell>34.5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">L</TableCell>
                    <TableCell>23</TableCell>
                    <TableCell>29</TableCell>
                    <TableCell>35.5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">XL</TableCell>
                    <TableCell>25</TableCell>
                    <TableCell>30</TableCell>
                    <TableCell>36.5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">2XL</TableCell>
                    <TableCell>26.5</TableCell>
                    <TableCell>31</TableCell>
                    <TableCell>37.5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">3XL</TableCell>
                    <TableCell>28</TableCell>
                    <TableCell>32</TableCell>
                    <TableCell>38.5</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Phone Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Phone Cases</CardTitle>
            <CardDescription>Compatible device models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Compatible Models</TableHead>
                    <TableHead>Dimensions (H × W)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">iPhone 15 Pro Max</TableCell>
                    <TableCell>iPhone 15 Pro Max</TableCell>
                    <TableCell>6.33" × 3.02"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">iPhone 15 Pro</TableCell>
                    <TableCell>iPhone 15 Pro, 15</TableCell>
                    <TableCell>5.81" × 2.81"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">iPhone 14 Pro Max</TableCell>
                    <TableCell>iPhone 14 Pro Max</TableCell>
                    <TableCell>6.33" × 3.05"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Samsung Galaxy S24</TableCell>
                    <TableCell>Galaxy S24</TableCell>
                    <TableCell>5.79" × 2.78"</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Samsung Galaxy S24+</TableCell>
                    <TableCell>Galaxy S24+</TableCell>
                    <TableCell>6.24" × 2.99"</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Posters & Prints */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Posters & Prints</CardTitle>
            <CardDescription>Available sizes - measurements in inches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Dimensions (W × H)</TableHead>
                    <TableHead>Orientation</TableHead>
                    <TableHead>Best For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">8" × 10"</TableCell>
                    <TableCell>8" × 10"</TableCell>
                    <TableCell>Portrait</TableCell>
                    <TableCell>Desk, small walls</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">11" × 14"</TableCell>
                    <TableCell>11" × 14"</TableCell>
                    <TableCell>Portrait</TableCell>
                    <TableCell>Small to medium walls</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">16" × 20"</TableCell>
                    <TableCell>16" × 20"</TableCell>
                    <TableCell>Portrait</TableCell>
                    <TableCell>Medium walls</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">18" × 24"</TableCell>
                    <TableCell>18" × 24"</TableCell>
                    <TableCell>Portrait/Landscape</TableCell>
                    <TableCell>Large walls</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">24" × 36"</TableCell>
                    <TableCell>24" × 36"</TableCell>
                    <TableCell>Portrait/Landscape</TableCell>
                    <TableCell>Statement pieces</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Still unsure about sizing?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you're between sizes, we recommend sizing up for a more comfortable fit.
            For specific product measurements or sizing questions, please{' '}
            <a href={`/${locale}/contact`} className="text-primary hover:underline">
              contact our support team
            </a>
            . We're here to help!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
