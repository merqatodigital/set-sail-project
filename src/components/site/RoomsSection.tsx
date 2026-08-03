import { useState } from "react";
import { Users, Layout, Map, Calendar, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useCurrency } from "@/context/CurrencyContext";
import { Card } from "@/components/ui";
import { getIcon } from "@/lib/icons";
import { openTala } from "@/components/tala/talaOpen";
import { Reveal } from "./Reveal";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { cn } from "@/utils/cn";

export function RoomsSection() {
  const { data } = useCms();
  const { formatPrice } = useCurrency();
  const facilities = data.homepage.facilities.items.filter((f) => f.visible !== false);
  const contact = data.settings.contact;
  const whatsapp = data.settings.whatsapp;

  // Pull rooms straight from the CMS so the admin Stay editor drives what
  // renders here. Each room's imageKey is a Media Library reference resolved
  // below to the actual uploaded URL.
  const rooms = [...(data.homepage.rooms || [])]
    .filter((r) => r.visible !== false)
    .sort((a, b) => a.order - b.order);

  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const activeRoom = rooms[activeRoomIdx];
  const activeImages = activeRoom ? [activeRoom.imageKey].filter(Boolean) : [];

  // Guest booking widget state
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  const handleNextImg = () => {
    if (activeImages.length === 0) return;
    setActiveImgIdx((prev) => (prev + 1) % activeImages.length);
  };

  const handlePrevImg = () => {
    if (activeImages.length === 0) return;
    setActiveImgIdx((prev) => (prev - 1 + activeImages.length) % activeImages.length);
  };

  const handleRoomTabChange = (idx: number) => {
    setActiveRoomIdx(idx);
    setActiveImgIdx(0);
  };

  if (!activeRoom) return null;

  const otherRooms = rooms.filter((r) => r.id !== activeRoom.id);

  return (
    <section id="accommodation" className="bg-[#FAF6EF] py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        
        {/* Room Tab Switcher (Professional, Minimal Segmented Controller) */}
        <div className="mb-12 flex justify-center">
          <div className="inline-flex rounded-full border border-[#26221C]/10 bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            {rooms.map((room, idx) => (
              <button
                key={room.id}
                onClick={() => handleRoomTabChange(idx)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-all duration-150 active:scale-[0.97] sm:h-10 sm:px-6 sm:text-sm",
                  activeRoomIdx === idx
                    ? "bg-[#26221C] text-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                    : "text-[#26221C]/55 hover:text-[#26221C]"
                )}
              >
                <span>{room.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Room Header info */}
        <Reveal className="mb-10 text-center lg:text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">Featured Accommodation</p>
          <h1 className="font-serif text-4xl font-light leading-tight text-[#26221C] sm:text-5xl lg:text-6xl">
            {activeRoom.name}
          </h1>
          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-[#26221C]/60 lg:justify-start">
            <span className="flex items-center gap-1.5"><Users className="h-4.5 w-4.5 text-[#C6A15B]" /> Sleeps: <strong className="text-[#26221C]">{activeRoom.capacity}</strong></span>
            <span className="flex items-center gap-1.5"><Layout className="h-4.5 w-4.5 text-[#C6A15B]" /> Size: <strong className="text-[#26221C]">{activeRoom.size}</strong></span>
            <span className="flex items-center gap-1.5"><Map className="h-4.5 w-4.5 text-[#C6A15B]" /> View: <strong className="text-[#26221C]">{activeRoom.view}</strong></span>
          </div>
        </Reveal>

        {/* Main Split Layout: Room Visuals vs Booking Widget */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-16">
          
          {/* Left Column: Image Slider + Description + Facilities */}
          <div className="space-y-12 lg:col-span-2">
            
            {/* Image Slider */}
            <div className="group relative overflow-hidden rounded-3xl border border-[#26221C]/8 bg-white shadow-md">
              <ImagePlaceholder
                mediaId={activeImages[activeImgIdx]}
                label={activeRoom.name}
                className="aspect-[16/10] w-full"
                rounded="rounded-3xl"
              />
              {activeImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImg}
                    className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#26221C] shadow-md backdrop-blur-sm transition-all hover:bg-white active:scale-95 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextImg}
                    className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#26221C] shadow-md backdrop-blur-sm transition-all hover:bg-white active:scale-95 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                    {activeImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImgIdx(idx)}
                        className={`h-2 w-2 rounded-full transition-all ${
                          idx === activeImgIdx ? "bg-white w-4" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Room Description */}
            <Reveal className="space-y-4">
              <h2 className="font-serif text-2xl font-light text-[#26221C]">Room Description</h2>
              <div className="h-0.5 w-12 bg-[#C6A15B]/40" />
              <div className="space-y-3 text-sm leading-relaxed text-[#26221C]/75">
                {activeRoom.description.split("\n").filter(Boolean).map((line, li) => (
                  <p key={li}>{line}</p>
                ))}
              </div>
            </Reveal>

            {/* Room-specific Facilities Grid */}
            <Reveal className="space-y-6">
              <h2 className="font-serif text-2xl font-light text-[#26221C]">Facilities</h2>
              <div className="h-0.5 w-12 bg-[#C6A15B]/40" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {facilities.map((fac) => {
                  const Icon = getIcon(fac.icon);
                  return (
                    <div key={fac.id} className="flex items-center gap-3 rounded-xl border border-[#26221C]/8 bg-white/60 p-3.5 shadow-sm">
                      <Icon className="h-4.5 w-4.5 text-[#C6A15B]" />
                      <span className="text-[13px] font-medium text-[#26221C]/85" dangerouslySetInnerHTML={{ __html: fac.name }} />
                    </div>
                  );
                })}
              </div>
            </Reveal>

          </div>

          {/* Right Column: Live Booking Widget Sticky Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              
              {/* Main Booking Card */}
              <Card className="p-6 shadow-md border-[#26221C]/10">
                <div className="mb-5 border-b border-[#26221C]/8 pb-4">
                  <p className="text-[10px] uppercase tracking-wider text-[#26221C]/40">Room Type</p>
                  <p className="font-serif text-lg font-medium text-[#26221C]">{activeRoom.name}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#26221C]/50">
                      <Calendar className="h-3.5 w-3.5 text-[#C6A15B]" /> Check In
                    </label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full rounded-xl border border-[#26221C]/15 bg-[#FAF6EF]/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#26221C]/50">
                      <Calendar className="h-3.5 w-3.5 text-[#C6A15B]" /> Check Out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full rounded-xl border border-[#26221C]/15 bg-[#FAF6EF]/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#26221C]/50">
                      <Users className="h-3.5 w-3.5 text-[#C6A15B]" /> Guests
                    </label>
                    <select
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="w-full rounded-xl border border-[#26221C]/15 bg-[#FAF6EF]/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20"
                    >
                      <option value="1">1 Guest</option>
                      <option value="2">2 Guests</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openTala(`Hi TALA! I'd like to book ${activeRoom.name} from ${checkIn || "check-in"} to ${checkOut || "check-out"} for ${guests} guest(s).`)}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C6A15B] text-xs font-semibold uppercase tracking-wider text-[#221D14] shadow-md shadow-[#C6A15B]/20 transition-all hover:bg-[#B8924B]"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>From {formatPrice(activeRoom.price)} / Night</span>
                </button>
              </Card>

              {/* Assistance Card */}
              <Card className="p-6 bg-white/40 border-[#26221C]/5">
                <p className="font-serif text-base font-medium text-[#26221C] border-b border-[#26221C]/8 pb-2">Need Assistance?</p>
                <p className="mt-3 text-xs leading-relaxed text-[#26221C]/65">Our dedicated reservations team is ready around the clock.</p>
                <div className="mt-4 space-y-2 text-xs text-[#26221C]/75">
                  <p>📍 {contact.address}</p>
                  <p>📞 {contact.phone}</p>
                  <p>✉️ {contact.email}</p>
                </div>
              </Card>

            </div>
          </div>

        </div>

        {/* Other Rooms Grid (Basic Room TRE, Single Room QUATTRO) */}
        {otherRooms.length > 0 && (
          <div className="mt-20 border-t border-[#26221C]/8 pt-16">
            <Reveal className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#C6A15B]">Explore Alternatives</p>
              <h2 className="font-serif text-3xl font-light text-[#26221C] sm:text-4xl">Other Rooms</h2>
            </Reveal>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {otherRooms.map((room) => (
                <div key={room.id} className="group overflow-hidden rounded-2xl border border-[#26221C]/8 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <ImagePlaceholder
                    mediaId={room.imageKey}
                    label={room.name}
                    className="aspect-[16/10] w-full"
                    rounded="rounded-none"
                  />
                  <div className="p-5">
                    <h3 className="font-serif text-lg font-medium text-[#26221C] group-hover:text-[#8A6B32] transition-colors">{room.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#26221C]/50">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {room.capacity}</span>
                      <span className="flex items-center gap-1"><Layout className="h-3.5 w-3.5" /> {room.size}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
