"use client";

import { useState, useMemo } from "react";
import { Plus, FileText, CheckCircle2, Clock, XCircle, X, Loader2, Eye, Search, ArrowRight, Package, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  body_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

const CATEGORIES = [
  { value: "UTILITY", label: "Utility", desc: "Order updates, alerts, account info" },
  { value: "MARKETING", label: "Marketing", desc: "Promotions, offers, announcements" },
  { value: "AUTHENTICATION", label: "Authentication", desc: "OTPs and verification codes" },
];

const LANGUAGES = [
  { value: "en_US", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "kn", label: "Kannada" },
];

const TEMPLATE_LIBRARY = [
  // ─── E-COMMERCE ───────────────────────────────────────────────────────────
  { industry: "🛍️ E-commerce", label: "Order Confirmed", category: "UTILITY", text: "Hi {{1}}! 🎉 Your order #{{2}} is confirmed.\n\n📦 Items: {{3}}\n💰 Total: ₹{{4}}\n🚚 Expected delivery: {{5}}\n\nThank you for shopping with us!" },
  { industry: "🛍️ E-commerce", label: "Order Shipped", category: "UTILITY", text: "Great news, {{1}}! 📦 Your order #{{2}} has been shipped.\n\n🚚 Courier: {{3}}\n🔍 Tracking ID: {{4}}\n📅 Estimated delivery: {{5}}\n\nTrack at: {{6}}" },
  { industry: "🛍️ E-commerce", label: "Out for Delivery", category: "UTILITY", text: "Almost there, {{1}}! 🚚\n\nOrder #{{2}} is out for delivery today.\n⏰ Expected arrival: {{3}}\n\nPlease keep your phone handy — our partner will call before arriving." },
  { industry: "🛍️ E-commerce", label: "Order Delivered", category: "UTILITY", text: "Delivered! ✅\n\nHi {{1}}, your order #{{2}} has been successfully delivered.\n\nHow was your experience? Reply REVIEW to share feedback, or HELP if there's any issue." },
  { industry: "🛍️ E-commerce", label: "Delivery Attempted", category: "UTILITY", text: "Hi {{1}}, we tried delivering order #{{2}} today but couldn't reach you. 😕\n\n📅 Next attempt: {{3}}\n\nTo reschedule or pick up at our facility, reply RESCHEDULE or call {{4}}." },
  { industry: "🛍️ E-commerce", label: "Return Initiated", category: "UTILITY", text: "Return Initiated ↩️\n\nHi {{1}}, your return for order #{{2}} has been processed.\n\n🎫 Return ID: {{3}}\n📅 Pickup date: {{4}}\n💰 Refund: ₹{{5}} in {{6}} working days." },
  { industry: "🛍️ E-commerce", label: "Refund Processed", category: "UTILITY", text: "Refund Done ✅\n\nHi {{1}}, your refund of ₹{{2}} for order #{{3}} has been processed.\n\nMode: {{4}}\nExpected credit: {{5}} business days.\n\nThank you for your patience! 🙏" },
  { industry: "🛍️ E-commerce", label: "Loyalty Points Earned", category: "UTILITY", text: "Points Added! 🌟\n\nHi {{1}}, you earned *{{2}} points* on order #{{3}}!\n\n💎 Total balance: {{4}} points (worth ₹{{5}})\n\nUse your points on your next order for instant cashback!" },
  { industry: "🛍️ E-commerce", label: "Flash Sale", category: "MARKETING", text: "🔥 FLASH SALE — {{1}}% OFF Everything!\n\nHi {{2}}, this is your exclusive early access.\n\n⏰ Sale ends: {{3}}\n🎯 Use code: {{4}}\n\nShop now before stocks run out! 🛒" },
  { industry: "🛍️ E-commerce", label: "Cart Abandoned", category: "MARKETING", text: "Hey {{1}}, you left something behind! 😢\n\n🛒 {{2}} item(s) worth ₹{{3}} are waiting in your cart.\n\n✨ Complete your order now — use code COMEBACK for extra 10% off!\n\nOffer valid for 24 hours only." },
  { industry: "🛍️ E-commerce", label: "Back in Stock", category: "MARKETING", text: "It's back! 🎉\n\nHi {{1}}, *{{2}}* is back in stock!\n\n⚠️ Only {{3}} units left. Grab it before it sells out again.\n\nReply SHOP or visit our store to order now." },
  { industry: "🛍️ E-commerce", label: "New Arrival Alert", category: "MARKETING", text: "New Arrivals Just Dropped! 🆕\n\nHi {{1}}, our latest {{2}} collection is now live!\n\n✨ {{3}} new products added\n🎁 First 100 orders get a free gift\n\nShop the new collection now →" },

  // ─── RESTAURANT & FOOD ────────────────────────────────────────────────────
  { industry: "🍽️ Restaurant & Food", label: "Order Received", category: "UTILITY", text: "Thanks {{1}}! 🍽️\n\nYour order #{{2}} has been received.\n\n⏱️ Estimated time: {{3}} minutes\n\nOur chef is already on it! We'll notify you when your food is ready." },
  { industry: "🍽️ Restaurant & Food", label: "Order Ready for Pickup", category: "UTILITY", text: "Your order is ready! 🔔\n\nHi {{1}}, order #{{2}} is ready for pickup at {{3}}.\n\n⏰ We'll hold it for 20 minutes. Come soon to enjoy it fresh & hot! 🌶️" },
  { industry: "🍽️ Restaurant & Food", label: "Food on the Way", category: "UTILITY", text: "Food is on the way! 🛵\n\nHi {{1}}, order #{{2}} is out for delivery.\n\n⏰ ETA: {{3}} minutes\n📍 Delivery to: {{4}}\n\nOur partner {{5}} will call on arrival." },
  { industry: "🍽️ Restaurant & Food", label: "Table Booking Confirmed", category: "UTILITY", text: "Table Reserved! 🍷\n\nHi {{1}}, your table at *{{2}}* is confirmed.\n\n📅 {{3}} at {{4}}\n👥 Guests: {{5}}\n\nArriving late? Reply LATE. Need to cancel? Reply CANCEL." },
  { industry: "🍽️ Restaurant & Food", label: "Reservation Reminder", category: "UTILITY", text: "Reminder! 🔔\n\nHi {{1}}, your table at *{{2}}* is reserved for tomorrow.\n\n⏰ {{3}} for {{4}} guests\n📍 {{5}}\n\nWe look forward to seeing you! Reply CANCEL if plans change." },
  { industry: "🍽️ Restaurant & Food", label: "Today's Special", category: "MARKETING", text: "Today's Chef Special! 🌟\n\nHi {{1}}, chef has something amazing today:\n\n🍴 {{2}} — ₹{{3}}\n🆓 Free {{4}} with every order!\n\nOrder: reply ORDER or call {{5}}" },
  { industry: "🍽️ Restaurant & Food", label: "Loyalty Reward", category: "MARKETING", text: "You've Earned a Reward! 🎁\n\nHi {{1}}, you've visited us {{2}} times!\n\nYour reward: *{{3}} OFF* on your next meal!\n\nValid till {{4}}. Show this message to redeem. 🙏" },

  // ─── HEALTHCARE ───────────────────────────────────────────────────────────
  { industry: "🏥 Healthcare", label: "Appointment Confirmed", category: "UTILITY", text: "Appointment Confirmed ✅\n\nHi {{1}}, your appointment is booked!\n\n👨‍⚕️ Doctor: Dr. {{2}}\n📅 {{3}} at {{4}}\n📍 {{5}}\n\nReply YES to confirm or RESCHEDULE to change." },
  { industry: "🏥 Healthcare", label: "Appointment Reminder", category: "UTILITY", text: "Appointment Tomorrow! 📅\n\nHi {{1}}, reminder: your appointment with Dr. {{2}} is tomorrow.\n\n⏰ {{3}} at {{4}}\n\n📋 Please carry previous reports. Reply CANCEL if you cannot attend." },
  { industry: "🏥 Healthcare", label: "Prescription Ready", category: "UTILITY", text: "Prescription Ready 💊\n\nHi {{1}}, your prescription is ready for collection.\n\n📍 Pick up from: {{2}}\n⏰ Available till: {{3}}\n\nFor home delivery, reply DELIVER. For queries, reply HELP." },
  { industry: "🏥 Healthcare", label: "Lab Report Ready", category: "UTILITY", text: "Reports Ready! 🔬\n\nHi {{1}}, your lab reports from {{2}} are ready.\n\nDownload: {{3}}\nOr collect from: {{4}}\n\nFor doctor consultation on results, reply CONSULT." },
  { industry: "🏥 Healthcare", label: "Medication Refill Reminder", category: "UTILITY", text: "Refill Reminder 💊\n\nHi {{1}}, your medication *{{2}}* is about to run out ({{3}} days left).\n\nOrder your refill now to avoid a break in treatment.\n\nReply REFILL or call {{4}}." },
  { industry: "🏥 Healthcare", label: "Health Checkup Due", category: "MARKETING", text: "Time for Your Annual Checkup! 🏥\n\nHi {{1}}, it's been {{2}} since your last health checkup.\n\n✅ Complete package: ₹{{3}} (₹{{4}} off)\n✅ Results in 24 hours\n✅ Free doctor consultation\n\nBook: reply BOOK or call {{5}}" },
  { industry: "🏥 Healthcare", label: "Health Camp Invitation", category: "MARKETING", text: "Free Health Camp! 🏕️\n\nHi {{1}}, we're organising a free health camp on {{2}}.\n\n✅ Free BP & sugar check\n✅ Free eye checkup\n✅ Free doctor consultation\n\n📍 {{3}} at {{4}}\nReply JOIN to register!" },

  // ─── REAL ESTATE ──────────────────────────────────────────────────────────
  { industry: "🏠 Real Estate", label: "Inquiry Received", category: "UTILITY", text: "Thank You for Your Inquiry! 🏠\n\nHi {{1}}, we received your inquiry about {{2}}.\n\nOur property expert will call you within {{3}} hours.\n\nIn the meantime, reply with any questions. We're here to help! 😊" },
  { industry: "🏠 Real Estate", label: "Site Visit Confirmed", category: "UTILITY", text: "Site Visit Confirmed! 🗓️\n\nHi {{1}}, your visit to *{{2}}* is scheduled:\n\n📅 {{3}} at {{4}}\n📍 {{5}}\n👤 Your agent: {{6}}\n\nReply DIRECTIONS for map or RESCHEDULE to change." },
  { industry: "🏠 Real Estate", label: "Token Amount Received", category: "UTILITY", text: "Token Received ✅\n\nHi {{1}}, we've received your token of ₹{{2}} for *{{3}}*.\n\n🎫 Receipt No: {{4}}\n📅 Agreement date: {{5}}\n\nOur team will contact you with next steps. Congratulations! 🎉" },
  { industry: "🏠 Real Estate", label: "Document Checklist", category: "UTILITY", text: "Documents Required 📋\n\nHi {{1}}, to proceed with your purchase at {{2}}, please keep these ready:\n\n1️⃣ PAN Card\n2️⃣ Aadhaar Card\n3️⃣ Income Proof (last 3 months)\n4️⃣ Bank Statements (6 months)\n5️⃣ {{3}}\n\nReply DONE when ready." },
  { industry: "🏠 Real Estate", label: "New Property Alert", category: "MARKETING", text: "New Property Alert! 🏡\n\nHi {{1}}, a new {{2}} BHK is available in {{3}}.\n\n💰 ₹{{4}} ({{5}} sq ft)\n✅ Ready to move\n📍 Near: {{6}}\n\nInterested? Reply VIEW for photos or VISIT to book a site tour." },
  { industry: "🏠 Real Estate", label: "Price Drop Alert", category: "MARKETING", text: "Price Reduced! 📉\n\nHi {{1}}, the {{2}} BHK in {{3}} that you viewed just dropped in price!\n\n💰 New price: ₹{{4}} (was ₹{{5}})\n\nLimited-time offer. Reply NOW to lock in this price!" },

  // ─── EDUCATION ────────────────────────────────────────────────────────────
  { industry: "🎓 Education", label: "Admission Confirmed", category: "UTILITY", text: "Admission Confirmed! 🎓\n\nCongratulations {{1}}! Your admission to *{{2}}* batch is confirmed.\n\n📅 Start date: {{3}}\n🏫 Venue: {{4}}\n📚 Materials: {{5}}\n\nWelcome aboard! Reply HELP for any queries." },
  { industry: "🎓 Education", label: "Class Reminder", category: "UTILITY", text: "Class in {{1}} Minutes! ⏰\n\nHi {{2}}, your *{{3}}* class is starting soon.\n\n📚 Topic: {{4}}\n🔗 Join: {{5}}\n\nHave your notes ready and join on time!" },
  { industry: "🎓 Education", label: "Fee Due", category: "UTILITY", text: "Fee Reminder 💳\n\nHi {{1}}, your fee of ₹{{2}} for *{{3}}* is due on {{4}}.\n\nPay online: {{5}}\n\n⚠️ Late payment attracts ₹{{6}} penalty per day. Pay on time!" },
  { industry: "🎓 Education", label: "Assignment Due", category: "UTILITY", text: "Assignment Due Soon! 📝\n\nHi {{1}}, your *{{2}}* assignment is due on {{3}}.\n\n📋 Topic: {{4}}\n📤 Submit at: {{5}}\n\nLate submissions will not be accepted. Submit on time! 🕐" },
  { industry: "🎓 Education", label: "Exam Timetable", category: "UTILITY", text: "Exam Schedule Released! 📅\n\nHi {{1}}, the {{2}} exam schedule is now available.\n\n📅 First exam: {{3}}\n📍 Venue: {{4}}\n🆔 Carry your hall ticket.\n\nDownload full schedule: {{5}}\n\nAll the best! 💪" },
  { industry: "🎓 Education", label: "Result Published", category: "UTILITY", text: "Results are Out! 🎊\n\nHi {{1}}, your {{2}} results have been published.\n\nCheck your result: {{3}}\n\nFor re-evaluation, contact us by {{4}}. Congratulations if you passed! 🎉" },
  { industry: "🎓 Education", label: "New Course Launch", category: "MARKETING", text: "New Course Alert! 🚀\n\nHi {{1}}, we just launched *{{2}}*!\n\n✅ {{3}} hours of content\n✅ Live + Recorded sessions\n✅ Certificate included\n🎁 Early bird: ₹{{4}} (save ₹{{5}})\n\nEnroll by {{6}} — reply JOIN!" },

  // ─── TRAVEL & HOTELS ──────────────────────────────────────────────────────
  { industry: "✈️ Travel & Hotels", label: "Booking Confirmed", category: "UTILITY", text: "Booking Confirmed! ✈️\n\nHi {{1}}, your booking is confirmed.\n\n🏨 {{2}}\n📅 Check-in: {{3}}\n📅 Check-out: {{4}}\n🔑 Booking ID: {{5}}\n\nHave a wonderful trip! 🌟" },
  { industry: "✈️ Travel & Hotels", label: "Check-in Reminder", category: "UTILITY", text: "Check-in Tomorrow! 🏨\n\nHi {{1}}, you're checking in to *{{2}}* tomorrow.\n\n⏰ Check-in time: {{3}}\n📍 {{4}}\n📞 Reception: {{5}}\n\nNeed early check-in or airport pickup? Reply here." },
  { industry: "✈️ Travel & Hotels", label: "Checkout Reminder", category: "UTILITY", text: "Checkout Day! 🧳\n\nHi {{1}}, today is your checkout day from *{{2}}*.\n\n⏰ Checkout time: {{3}}\n\nFor late checkout, reply LATE. For luggage storage, reply LUGGAGE.\n\nThank you for staying with us! 🙏" },
  { industry: "✈️ Travel & Hotels", label: "Flight Update", category: "UTILITY", text: "Flight Update ✈️\n\nHi {{1}}, update on your flight {{2}}:\n\n🔄 Status: {{3}}\n⏰ New departure: {{4}}\n🚪 Gate: {{5}}\n\nPlease report to the airport early. For queries, call {{6}}." },
  { industry: "✈️ Travel & Hotels", label: "Exclusive Travel Deal", category: "MARKETING", text: "Exclusive Deal for You! 🌍\n\nHi {{1}}, *{{2}} trip* — only ₹{{3}}/person!\n\n📅 Travel dates: {{4}}\n✅ Includes: Flights + Hotel + Breakfast\n⚠️ Only {{5}} seats left!\n\nBook by {{6}} — reply BOOK now!" },
  { industry: "✈️ Travel & Hotels", label: "Post-Trip Review", category: "MARKETING", text: "How Was Your Trip? 🌟\n\nHi {{1}}, hope you had an amazing time at *{{2}}*!\n\nWould you spare 1 minute to share your experience?\n\n⭐ Rate & Review: {{3}}\n\nYour feedback helps us serve you better. Thank you! 🙏" },

  // ─── FINANCE ──────────────────────────────────────────────────────────────
  { industry: "💰 Finance", label: "Payment Received", category: "UTILITY", text: "Payment Received ✅\n\nHi {{1}}, we received your payment of *₹{{2}}*.\n\n📋 Against: {{3}}\n🔖 Transaction ID: {{4}}\n📅 Date: {{5}}\n\nDownload receipt: {{6}}\n\nThank you!" },
  { industry: "💰 Finance", label: "EMI Due Reminder", category: "UTILITY", text: "EMI Due in {{1}} Days 💳\n\nHi {{2}}, your EMI of *₹{{3}}* for {{4}} is due on {{5}}.\n\nPay on time to protect your credit score.\n\nPay online: {{6}} or call {{7}}" },
  { industry: "💰 Finance", label: "Account Statement Ready", category: "UTILITY", text: "Statement Ready 📄\n\nHi {{1}}, your {{2}} account statement for {{3}} is ready.\n\n📥 Download: {{4}}\n\nFor any transaction query, reply with the transaction ID." },
  { industry: "💰 Finance", label: "KYC Reminder", category: "UTILITY", text: "KYC Update Required ⚠️\n\nHi {{1}}, your KYC documents need to be updated by {{2}} to avoid service disruption.\n\nUpdate online: {{3}}\nOr visit branch: {{4}}\n\nReply HELP for assistance." },
  { industry: "💰 Finance", label: "Insurance Renewal", category: "UTILITY", text: "Policy Renewal Due 🛡️\n\nHi {{1}}, your *{{2}}* policy (No: {{3}}) renews on {{4}}.\n\n💰 Premium: ₹{{5}}/year\n\nRenew now to avoid coverage lapse. Reply RENEW or call {{6}}." },
  { industry: "💰 Finance", label: "Investment Update", category: "UTILITY", text: "Portfolio Update 📈\n\nHi {{1}}, here's your investment summary for {{2}}:\n\n💰 Total invested: ₹{{3}}\n📊 Current value: ₹{{4}}\n🚀 Returns: {{5}}%\n\nFor full statement, reply STATEMENT or visit {{6}}." },
  { industry: "💰 Finance", label: "Pre-approved Loan Offer", category: "MARKETING", text: "You're Pre-Approved! 🎉\n\nHi {{1}}, you qualify for an instant loan up to *₹{{2}}*.\n\n✅ Rate: {{3}}% per annum\n✅ Tenure: up to {{4}} months\n✅ No collateral\n✅ Disbursed in 4 hours\n\nApply now — reply YES to proceed." },

  // ─── GENERAL BUSINESS ─────────────────────────────────────────────────────
  { industry: "💼 General Business", label: "Welcome Message", category: "UTILITY", text: "Welcome to {{1}}! 🎉\n\nHi {{2}}, great to have you with us!\n\nHere's how I can help:\n1️⃣ Reply MENU — see all services\n2️⃣ Reply PRICE — get pricing\n3️⃣ Reply HUMAN — talk to our team\n4️⃣ Reply HOURS — business hours\n\nWe're here 24/7! 😊" },
  { industry: "💼 General Business", label: "Support Ticket Created", category: "UTILITY", text: "Ticket Created ✅\n\nHi {{1}}, we've logged your support request.\n\n🎫 Ticket ID: *{{2}}*\n📋 Issue: {{3}}\n⏰ Expected resolution: {{4}}\n\nReply {{2}} anytime for status update." },
  { industry: "💼 General Business", label: "Support Ticket Resolved", category: "UTILITY", text: "Issue Resolved ✅\n\nHi {{1}}, your ticket *{{2}}* has been resolved.\n\n📋 Resolution: {{3}}\n\nStill facing issues? Reply REOPEN. Happy with our service? Reply REVIEW. 😊" },
  { industry: "💼 General Business", label: "Invoice Sent", category: "UTILITY", text: "Invoice Ready 📄\n\nHi {{1}}, your invoice for *{{2}}* is ready.\n\n🔖 Invoice No: {{3}}\n💰 Amount: ₹{{4}}\n📅 Due date: {{5}}\n\nDownload: {{6}}\n\nFor queries, reply here. Thank you! 🙏" },
  { industry: "💼 General Business", label: "Payment Reminder", category: "UTILITY", text: "Payment Reminder ⏰\n\nHi {{1}}, friendly reminder about invoice *{{2}}*.\n\n💰 Amount due: ₹{{3}}\n📅 Due date: {{4}}\n\nPay online: {{5}}\n\nAlready paid? Please ignore. Thank you!" },
  { industry: "💼 General Business", label: "Quote Ready", category: "UTILITY", text: "Your Quote is Ready! 📋\n\nHi {{1}}, the quotation for *{{2}}* is ready.\n\n💰 Total: ₹{{3}}\n⏰ Valid for: {{4}} days\n\nDownload: {{5}}\n\nWant to proceed? Reply CONFIRM. Questions? Reply here." },
  { industry: "💼 General Business", label: "Review Request", category: "MARKETING", text: "How Did We Do? ⭐\n\nHi {{1}}, thank you for choosing *{{2}}*!\n\nYour feedback means a lot. Could you spare 30 seconds to leave a review?\n\n⭐ {{3}}\n\nThank you so much! 🙏" },
  { industry: "💼 General Business", label: "OTP Verification", category: "AUTHENTICATION", text: "Your OTP is *{{1}}*\n\nThis is your verification code for *{{2}}*. Valid for {{3}} minutes.\n\n🔒 Do not share this OTP with anyone, including our staff." },

  // ─── SALON & BEAUTY ───────────────────────────────────────────────────────
  { industry: "💇 Salon & Beauty", label: "Appointment Confirmed", category: "UTILITY", text: "Appointment Booked! 💅\n\nHi {{1}}, your appointment at *{{2}}* is confirmed.\n\n💆 Service: {{3}}\n👩‍💼 Stylist: {{4}}\n📅 {{5}} at {{6}}\n\nFor changes, reply CHANGE. See you soon! ✨" },
  { industry: "💇 Salon & Beauty", label: "Reminder Day Before", category: "UTILITY", text: "Appointment Tomorrow! ✨\n\nHi {{1}}, you have an appointment at *{{2}}* tomorrow.\n\n⏰ {{3}} with {{4}}\n💆 Service: {{5}}\n\nCan't make it? Reply CANCEL at least 2 hours in advance. See you soon! 💅" },
  { industry: "💇 Salon & Beauty", label: "Reminder 1 Hour Before", category: "UTILITY", text: "1 Hour to Go! ⏰\n\nHi {{1}}, your appointment at *{{2}}* is in 1 hour.\n\n📍 Address: {{3}}\n\nRunning late? Reply LATE and we'll try to accommodate. See you soon! 💅" },
  { industry: "💇 Salon & Beauty", label: "No-show Reschedule", category: "UTILITY", text: "We Missed You! 😢\n\nHi {{1}}, you couldn't make it to your appointment today.\n\nNo worries! Available slots:\n📅 {{2}}\n📅 {{3}}\n📅 {{4}}\n\nReply with your preferred slot or call {{5}}." },
  { industry: "💇 Salon & Beauty", label: "Monthly Special Offer", category: "MARKETING", text: "Exclusive Offer for You! 💆‍♀️\n\nHi {{1}}, this month at *{{2}}*:\n\n✂️ {{3}} — {{4}}% off\n💅 {{5}} — {{6}}% off\n\nValid till {{7}}. Book: reply BOOK or call {{8}}." },
  { industry: "💇 Salon & Beauty", label: "Membership Expiry", category: "UTILITY", text: "Membership Expiring Soon! 👑\n\nHi {{1}}, your {{2}} membership at *{{3}}* expires on {{4}}.\n\nRenew now to keep enjoying:\n✅ {{5}}% off all services\n✅ Priority booking\n✅ Free monthly {{6}}\n\nReply RENEW" },

  // ─── FITNESS & COACHING ───────────────────────────────────────────────────
  { industry: "🏋️ Fitness & Coaching", label: "Session Confirmed", category: "UTILITY", text: "Session Booked! 💪\n\nHi {{1}}, your {{2}} session is confirmed.\n\n👨‍🏫 Trainer: {{3}}\n📅 {{4}} at {{5}}\n📍 {{6}}\n\nWear comfortable clothes and bring water. See you! 🏋️" },
  { industry: "🏋️ Fitness & Coaching", label: "Session Reminder", category: "UTILITY", text: "Workout Time! 💪\n\nHi {{1}}, your {{2}} session with {{3}} is in *{{4}} minutes*.\n\n📍 {{5}}\n\nConsistency is key! See you there 🏋️" },
  { industry: "🏋️ Fitness & Coaching", label: "Missed Session Follow-up", category: "UTILITY", text: "We Missed You! 😊\n\nHi {{1}}, you missed your {{2}} session today. That's okay!\n\nYour next session: {{3}} at {{4}}\n\nStay consistent and you'll hit your goal of *{{5}}*! 💪" },
  { industry: "🏋️ Fitness & Coaching", label: "Monthly Progress Report", category: "UTILITY", text: "Monthly Progress Report 📊\n\nHi {{1}}, here's your {{2}} summary:\n\n⚖️ Weight: {{3}} → {{4}}\n💪 Key achievement: {{5}}\n🎯 Next month goal: {{6}}\n\nYou're doing amazing! Keep going! 🔥" },
  { industry: "🏋️ Fitness & Coaching", label: "New Batch / Offer", category: "MARKETING", text: "New Batch Starting! 🏋️\n\nHi {{1}}, a new *{{2}}* batch starts on {{3}}.\n\n⏰ Timings: {{4}}\n👥 Limited spots: {{5}} only\n🎁 Join now: ₹{{6}} (save ₹{{7}})\n\nReply JOIN to reserve your spot!" },

  // ─── AUTOMOTIVE ───────────────────────────────────────────────────────────
  { industry: "🚗 Automotive", label: "Service Appointment Confirmed", category: "UTILITY", text: "Service Booked! 🚗\n\nHi {{1}}, your vehicle service is confirmed.\n\n🔧 Service: {{2}}\n📅 {{3}} at {{4}}\n📍 {{5}}\n\nPlease bring your RC book and insurance. See you! 🛠️" },
  { industry: "🚗 Automotive", label: "Vehicle Ready for Pickup", category: "UTILITY", text: "Your Vehicle is Ready! ✅\n\nHi {{1}}, your {{2}} ({{3}}) is ready for pickup.\n\n🔧 Work done: {{4}}\n💰 Amount: ₹{{5}}\n📍 Pick up from: {{6}}\n⏰ Open till: {{7}}\n\nReply INVOICE for detailed bill." },
  { industry: "🚗 Automotive", label: "Service Due Reminder", category: "MARKETING", text: "Service Due! 🔧\n\nHi {{1}}, your {{2}} ({{3}}) is due for service.\n\n📅 Last serviced: {{4}}\n📍 KMs driven: {{5}}\n\nBook your service and get a FREE car wash! 🚿\n\nCall {{6}} or reply BOOK." },
  { industry: "🚗 Automotive", label: "Test Drive Confirmed", category: "UTILITY", text: "Test Drive Confirmed! 🚘\n\nHi {{1}}, your test drive of *{{2}}* is scheduled.\n\n📅 {{3}} at {{4}}\n📍 {{5}}\n👤 Sales executive: {{6}} ({{7}})\n\nNeed pickup? Reply PICKUP." },
  { industry: "🚗 Automotive", label: "Vehicle Insurance Renewal", category: "UTILITY", text: "Insurance Due! 🛡️\n\nHi {{1}}, your insurance for *{{2}} ({{3}})* expires on {{4}}.\n\nDon't drive uninsured! Renew now:\n💰 Premium: ₹{{5}}/year\n\nCall {{6}} or reply RENEW for instant renewal." },

  // ─── EVENTS & WEDDINGS ────────────────────────────────────────────────────
  { industry: "🎪 Events & Weddings", label: "Booking Confirmed", category: "UTILITY", text: "Booking Confirmed! 🎊\n\nDear {{1}}, we're honoured to be part of your *{{2}}*!\n\n📅 Date: {{3}}\n📍 Venue: {{4}}\n🤝 Your coordinator: {{5}}\n\nWe'll be in touch to plan every detail. Congratulations! 🎉" },
  { industry: "🎪 Events & Weddings", label: "1 Week Reminder", category: "UTILITY", text: "1 Week to Go! 🎊\n\nHi {{1}}, your *{{2}}* is exactly one week away!\n\n📋 Pending items:\n{{3}}\n\nContact coordinator {{4}} for last-minute changes. So exciting! 🎉" },
  { industry: "🎪 Events & Weddings", label: "1 Day Reminder", category: "UTILITY", text: "Tomorrow is the Big Day! 🎊\n\nDear {{1}}, your *{{2}}* is tomorrow!\n\n📅 {{3}}\n⏰ Starts at: {{4}}\n📍 {{5}}\n\nCoordinator {{6}} will be on site from {{7}}. See you tomorrow! ✨" },
  { industry: "🎪 Events & Weddings", label: "Payment Due", category: "UTILITY", text: "Payment Reminder 💳\n\nHi {{1}}, the next payment for your *{{2}}* booking is due.\n\n💰 Amount: ₹{{3}}\n📅 Due by: {{4}}\n\nPay online: {{5}}\nFor queries, call coordinator {{6}}." },
  { industry: "🎪 Events & Weddings", label: "Thank You Post Event", category: "MARKETING", text: "Thank You! 🙏\n\nDear {{1}}, it was our pleasure being part of your *{{2}}*!\n\nWe hope everything was perfect. 💕\n\nWould you share your experience?\n⭐ {{3}}\n\nThank you for choosing us! 🎊" },

  // ─── FASHION & RETAIL ─────────────────────────────────────────────────────
  { industry: "👗 Fashion & Retail", label: "Order Confirmed", category: "UTILITY", text: "Order Confirmed! 👗\n\nHi {{1}}, order #{{2}} is confirmed.\n\n👗 {{3}} (Size: {{4}}, Colour: {{5}})\n💰 Amount: ₹{{6}}\n📅 Expected delivery: {{7}}\n\nThank you for shopping with us! 🛍️" },
  { industry: "👗 Fashion & Retail", label: "New Collection Launch", category: "MARKETING", text: "New Collection is Here! ✨\n\nHi {{1}}, our *{{2}} Collection* just dropped!\n\n🎨 {{3}} new styles\n🏷️ Starting ₹{{4}}\n🎁 Free shipping above ₹{{5}}\n\nShop now before your size sells out! →" },
  { industry: "👗 Fashion & Retail", label: "Sale Alert", category: "MARKETING", text: "Sale is LIVE! 🎉\n\nHi {{1}}, *{{2}} SALE* starts now!\n\n💸 Up to {{3}}% off\n🏷️ Extra {{4}}% with code: {{5}}\n⏰ Ends: {{6}}\n\nHurry — limited stock! Tap to shop now 🛍️" },
  { industry: "👗 Fashion & Retail", label: "Stock/Size Query Reply", category: "UTILITY", text: "Hi {{1}}! 👋\n\nAbout *{{2}}*:\n\n📦 Availability: {{3}}\n📐 Sizes in stock: {{4}}\n💰 Price: ₹{{5}}\n\nWant to order? Reply with your size and we'll get it packed for you!" },
  { industry: "👗 Fashion & Retail", label: "Exchange Update", category: "UTILITY", text: "Exchange Update 🔄\n\nHi {{1}}, your exchange for *{{2}}* has been processed.\n\nNew item: {{3}} (Size: {{4}})\n📅 Expected delivery: {{5}}\n\nReturn your original item to our courier. Questions? Reply here." },

  // ─── GROCERY & DELIVERY ───────────────────────────────────────────────────
  { industry: "🛒 Grocery & Delivery", label: "Order Confirmed", category: "UTILITY", text: "Order Received! 🛒\n\nHi {{1}}, your order #{{2}} is confirmed.\n\n📦 {{3}} items\n💰 Total: ₹{{4}}\n🚚 Delivery by: {{5}}\n\nWe're packing your order fresh right now! 🥬" },
  { industry: "🛒 Grocery & Delivery", label: "Order Out for Delivery", category: "UTILITY", text: "On the Way! 🛵\n\nHi {{1}}, order #{{2}} is out for delivery.\n\n⏰ ETA: {{3}} minutes\n📍 Delivering to: {{4}}\n\nOur partner {{5}} will call before arriving. Keep your phone handy!" },
  { industry: "🛒 Grocery & Delivery", label: "Weekly Deals", category: "MARKETING", text: "This Week's Best Deals! 🛒\n\nHi {{1}}, fresh deals for you:\n\n🥦 {{2}} — ₹{{3}} (save ₹{{4}})\n🍅 {{5}} — ₹{{6}} (save ₹{{7}})\n🥛 {{8}} — ₹{{9}}\n\nFree delivery above ₹{{10}}! Reply ORDER" },
  { industry: "🛒 Grocery & Delivery", label: "Subscription Renewal", category: "UTILITY", text: "Subscription Due 📅\n\nHi {{1}}, your {{2}} subscription expires on {{3}}.\n\n📦 Next delivery: {{4}}\n💰 Renewal: ₹{{5}}/month\n\nRenew now to avoid interruption. Reply RENEW or call {{6}}." },

  // ─── PROFESSIONAL SERVICES ────────────────────────────────────────────────
  { industry: "📊 Professional Services", label: "Appointment Confirmed", category: "UTILITY", text: "Appointment Confirmed ✅\n\nHi {{1}}, your meeting with *{{2}}* is scheduled:\n\n📅 {{3}} at {{4}}\n📍 {{5}}\n\nPlease carry relevant documents. Reply RESCHEDULE if needed." },
  { industry: "📊 Professional Services", label: "Document Required", category: "UTILITY", text: "Documents Needed 📋\n\nHi {{1}}, to proceed with your {{2}}, we need the following by {{3}}:\n\n1️⃣ {{4}}\n2️⃣ {{5}}\n3️⃣ {{6}}\n\nShare via WhatsApp or email to {{7}}. Reply SENT when done." },
  { industry: "📊 Professional Services", label: "Work Completed", category: "UTILITY", text: "Work Completed ✅\n\nHi {{1}}, your *{{2}}* has been completed.\n\n📄 {{3}}\n📥 Download: {{4}}\n\nYour invoice of ₹{{5}} is attached. Thank you for trusting us! 🙏" },
  { industry: "📊 Professional Services", label: "Invoice Sent", category: "UTILITY", text: "Invoice #{{1}} 📄\n\nHi {{2}}, your invoice for *{{3}}* is ready.\n\n💰 Amount: ₹{{4}}\n📅 Due: {{5}}\n🔗 Pay online: {{6}}\n\nThank you for your business! 🙏" },
  { industry: "📊 Professional Services", label: "Deadline Reminder", category: "UTILITY", text: "Deadline Alert ⚠️\n\nHi {{1}}, important reminder:\n\n📋 *{{2}}* is due on {{3}}\n\nTo avoid penalties, please share the required documents by {{4}}.\n\nReply URGENT for immediate assistance." },
];

const INDUSTRIES = [...new Set(TEMPLATE_LIBRARY.map((t) => t.industry))];

const FLOW_PACKS = [
  {
    id: "ecommerce",
    emoji: "🛍️",
    label: "E-commerce Order Flow",
    desc: "Complete order journey — from purchase confirmation to delivery",
    color: "from-green-50 to-emerald-50 border-green-100",
    steps: [
      { step: 1, label: "Order Confirmed", when: "Immediately after purchase", industry: "🛍️ E-commerce" },
      { step: 2, label: "Order Shipped", when: "When item leaves warehouse", industry: "🛍️ E-commerce" },
      { step: 3, label: "Out for Delivery", when: "On the delivery day morning", industry: "🛍️ E-commerce" },
      { step: 4, label: "Order Delivered", when: "After successful delivery", industry: "🛍️ E-commerce" },
    ],
  },
  {
    id: "healthcare",
    emoji: "🏥",
    label: "Healthcare Patient Flow",
    desc: "Complete patient journey — from booking to post-visit care",
    color: "from-blue-50 to-cyan-50 border-blue-100",
    steps: [
      { step: 1, label: "Appointment Confirmed", when: "When appointment is booked", industry: "🏥 Healthcare" },
      { step: 2, label: "Appointment Reminder", when: "24 hours before the appointment", industry: "🏥 Healthcare" },
      { step: 3, label: "Prescription Ready", when: "After visit — when prescription is ready", industry: "🏥 Healthcare" },
      { step: 4, label: "Medication Refill Reminder", when: "When medication is about to run out", industry: "🏥 Healthcare" },
    ],
  },
  {
    id: "restaurant",
    emoji: "🍽️",
    label: "Restaurant Table Flow",
    desc: "Booking to post-meal loyalty — keep customers coming back",
    color: "from-orange-50 to-amber-50 border-orange-100",
    steps: [
      { step: 1, label: "Table Booking Confirmed", when: "When reservation is made", industry: "🍽️ Restaurant & Food" },
      { step: 2, label: "Reservation Reminder", when: "1 day before reservation", industry: "🍽️ Restaurant & Food" },
      { step: 3, label: "Loyalty Reward", when: "After 5th visit", industry: "🍽️ Restaurant & Food" },
    ],
  },
  {
    id: "real_estate",
    emoji: "🏠",
    label: "Real Estate Buyer Flow",
    desc: "From first inquiry to signing — guide buyers step by step",
    color: "from-violet-50 to-purple-50 border-violet-100",
    steps: [
      { step: 1, label: "Inquiry Received", when: "When inquiry comes in", industry: "🏠 Real Estate" },
      { step: 2, label: "Site Visit Confirmed", when: "When visit is scheduled", industry: "🏠 Real Estate" },
      { step: 3, label: "Token Amount Received", when: "When booking amount is paid", industry: "🏠 Real Estate" },
      { step: 4, label: "Document Checklist", when: "1 week before registration", industry: "🏠 Real Estate" },
    ],
  },
  {
    id: "salon",
    emoji: "💇",
    label: "Salon Customer Flow",
    desc: "Booking to follow-up — reduce no-shows and build loyalty",
    color: "from-rose-50 to-pink-50 border-rose-100",
    steps: [
      { step: 1, label: "Appointment Confirmed", when: "When appointment is booked", industry: "💇 Salon & Beauty" },
      { step: 2, label: "Reminder Day Before", when: "24 hours before appointment", industry: "💇 Salon & Beauty" },
      { step: 3, label: "Reminder 1 Hour Before", when: "60 minutes before appointment", industry: "💇 Salon & Beauty" },
      { step: 4, label: "Monthly Special Offer", when: "Monthly to all past customers", industry: "💇 Salon & Beauty" },
    ],
  },
  {
    id: "education",
    emoji: "🎓",
    label: "Education Student Flow",
    desc: "Admission to results — keep students engaged throughout",
    color: "from-yellow-50 to-amber-50 border-yellow-100",
    steps: [
      { step: 1, label: "Admission Confirmed", when: "When admission is confirmed", industry: "🎓 Education" },
      { step: 2, label: "Class Reminder", when: "30 minutes before each class", industry: "🎓 Education" },
      { step: 3, label: "Exam Timetable", when: "When exams are scheduled", industry: "🎓 Education" },
      { step: 4, label: "Result Published", when: "When results are declared", industry: "🎓 Education" },
    ],
  },
];

export function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0]);
  const [showFlows, setShowFlows] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    body_text: "",
  });

  const resetForm = () => {
    setForm({ name: "", category: "UTILITY", language: "en_US", body_text: "" });
    setError(null);
    setShowForm(false);
    setShowLibrary(false);
    setShowFlows(false);
  };

  const applyTemplate = (tpl: typeof TEMPLATE_LIBRARY[0]) => {
    const nameSlug = tpl.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setForm((f) => ({ ...f, body_text: tpl.text, category: tpl.category, name: f.name || nameSlug }));
    setShowLibrary(false);
    setShowFlows(false);
    setShowForm(true);
  };

  const applyFlowStep = (step: typeof FLOW_PACKS[0]["steps"][0]) => {
    const tpl = TEMPLATE_LIBRARY.find(t => t.industry === step.industry && t.label === step.label);
    if (tpl) applyTemplate(tpl);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return setError("Template name is required.");
    if (!/^[a-z0-9_]+$/.test(form.name.trim())) return setError("Name must be lowercase letters, numbers, and underscores only.");
    if (!form.body_text.trim()) return setError("Template body is required.");
    if (form.body_text.length < 10) return setError("Template body is too short.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates((prev) => [data.template, ...prev]);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/whatsapp/templates?id=${id}&name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete template");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setConfirmDeleteId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
    if (status === "rejected") return <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold"><XCircle className="w-3 h-3" /> Rejected</span>;
    return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold"><Clock className="w-3 h-3" /> Pending</span>;
  };

  const searchFiltered = useMemo(() => {
    const q = librarySearch.toLowerCase();
    if (!q) return TEMPLATE_LIBRARY.filter(t => t.industry === selectedIndustry);
    return TEMPLATE_LIBRARY.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.text.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q)
    );
  }, [selectedIndustry, librarySearch]);

  const isSearching = librarySearch.trim().length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Message Templates</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">Create WhatsApp-approved templates for broadcasts and automations.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setShowLibrary(!showLibrary); setShowForm(false); setShowFlows(false); setLibrarySearch(""); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span className="whitespace-nowrap">{TEMPLATE_LIBRARY.length}+ Templates</span>
          </button>
          <button
            onClick={() => { setShowForm(true); setShowLibrary(false); setShowFlows(false); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all shadow-lg shadow-[#25D366]/20"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">New Template</span>
          </button>
        </div>
      </div>

      {/* Info banner */}
      {!showForm && !showLibrary && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Templates require Meta approval (usually within 24 hours)</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">
              Browse our <span className="font-bold">{TEMPLATE_LIBRARY.length}+ prebuilt templates</span> across 15 industries, or use a <span className="font-bold">Business Flow</span> to set up a complete customer journey in minutes.
            </p>
          </div>
        </div>
      )}

      {/* Template Library */}
      {showLibrary && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-lg p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Template Library</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{TEMPLATE_LIBRARY.length} ready-to-use templates · {FLOW_PACKS.length} complete business flows</p>
            </div>
            <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Library / Flows toggle + Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="flex gap-2">
              <button
                onClick={() => { setShowFlows(false); setLibrarySearch(""); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${!showFlows ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                By Industry
              </button>
              <button
                onClick={() => { setShowFlows(true); setLibrarySearch(""); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${showFlows ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Package className="w-3.5 h-3.5" /> Business Flows
              </button>
            </div>
            {!showFlows && (
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
              </div>
            )}
          </div>

          {showFlows ? (
            /* ── Flow Packs View ── */
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">Set up your complete customer journey by creating all templates in a flow. Each step is a separate WhatsApp template.</p>
              {FLOW_PACKS.map((pack) => (
                <div key={pack.id} className={`border rounded-2xl p-5 bg-gradient-to-br ${pack.color}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">{pack.emoji}</span>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{pack.label}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{pack.desc}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {pack.steps.map((step, i) => (
                      <div key={step.label} className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl p-3">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          {step.step}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">{step.label}</p>
                          <p className="text-xs text-slate-400 font-medium truncate">Send: {step.when}</p>
                        </div>
                        {i < pack.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-300 hidden sm:block shrink-0" />
                        )}
                        <button
                          onClick={() => applyFlowStep(step)}
                          className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1DA851] transition-colors shrink-0"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── By Industry View ── */
            <>
              {!isSearching && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      onClick={() => setSelectedIndustry(ind)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedIndustry === ind ? "bg-[#25D366] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              )}

              {isSearching && (
                <p className="text-xs text-slate-500 font-medium mb-3">{searchFiltered.length} results for "{librarySearch}"</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchFiltered.map((tpl) => (
                  <div key={tpl.label + tpl.industry} className="border border-slate-100 rounded-2xl p-4 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all group">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tpl.label}</p>
                        {isSearching && <p className="text-[10px] text-slate-400 font-medium">{tpl.industry}</p>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block ${
                          tpl.category === "MARKETING" ? "bg-purple-50 text-purple-700" :
                          tpl.category === "AUTHENTICATION" ? "bg-blue-50 text-blue-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>{tpl.category}</span>
                      </div>
                      <button
                        onClick={() => applyTemplate(tpl)}
                        className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1DA851] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        Use This
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3 whitespace-pre-line">{tpl.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-[2rem] border border-[#25D366]/20 shadow-lg shadow-[#25D366]/5 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-slate-900">Create Template</h2>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">Want a head start?</p>
              <button
                onClick={() => { setShowLibrary(true); setShowForm(false); }}
                className="text-xs font-bold text-[#25D366] hover:underline flex items-center gap-1"
              >
                Browse {TEMPLATE_LIBRARY.length}+ prebuilt templates →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. order_confirmation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase letters, numbers, underscores only</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] bg-white"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${form.category === cat.value ? "border-[#25D366] bg-[#25D366]/5" : "border-slate-100 hover:border-slate-200"}`}
                  >
                    <p className={`text-sm font-bold ${form.category === cat.value ? "text-[#25D366]" : "text-slate-700"}`}>{cat.label}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Template Body</label>
              <textarea
                rows={6}
                placeholder="Hi {{1}}, your order #{{2}} is confirmed! Delivery expected by {{3}}."
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-slate-400 font-medium">Use {`{{1}}`}, {`{{2}}`} for dynamic values (name, order no, etc.)</p>
                <p className={`text-xs font-medium ${form.body_text.length > 900 ? "text-rose-500" : "text-slate-400"}`}>{form.body_text.length}/1024</p>
              </div>
            </div>

            {form.body_text && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp Preview</label>
                <div className="bg-[#E5DDD5] rounded-2xl p-4">
                  <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-xs shadow-sm">
                    <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{form.body_text}</p>
                    <p className="text-[10px] text-slate-400 text-right mt-1">12:00 PM ✓✓</p>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {saving ? "Submitting..." : "Submit for Meta Approval"}
              </button>
              <button onClick={resetForm} className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {templates.length > 0 ? (
          templates.map((tpl) => (
            <div key={tpl.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(tpl.status)}
                  {confirmDeleteId === tpl.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        disabled={deleting}
                        className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                      >
                        {deleting ? "…" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(tpl.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-0.5">{tpl.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {tpl.category} • {LANGUAGES.find((l) => l.value === tpl.language)?.label ?? tpl.language}
              </p>
              <div className="bg-[#E5DDD5] rounded-xl p-3 flex-1 mb-3">
                <div className="bg-white rounded-xl rounded-tl-none p-2.5 shadow-sm">
                  <p className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-3 whitespace-pre-line">{tpl.body_text}</p>
                </div>
              </div>
              <button
                onClick={() => setPreview(tpl)}
                className="text-xs font-bold text-[#25D366] hover:text-[#1DA851] flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Full Preview
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full p-12 md:p-16 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-5 text-slate-300">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No templates yet</h3>
            <p className="text-slate-400 text-sm font-medium max-w-sm mx-auto mb-5">
              Start from our library of {TEMPLATE_LIBRARY.length}+ prebuilt templates — or use a Business Flow to set up a complete customer journey.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={() => { setShowFlows(true); setShowLibrary(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1DA851] transition-all"
              >
                <Package className="w-4 h-4" /> Use a Business Flow
              </button>
              <button
                onClick={() => setShowLibrary(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                <FileText className="w-4 h-4" /> Browse All Templates
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-900">{preview.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{preview.category} • {LANGUAGES.find((l) => l.value === preview.language)?.label}</p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#E5DDD5] rounded-2xl p-4">
              <div className="bg-white rounded-xl rounded-tl-none p-3 shadow-sm">
                <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{preview.body_text}</p>
                <p className="text-[10px] text-slate-400 text-right mt-2">12:00 PM ✓✓</p>
              </div>
            </div>
            <div className="mt-4">{statusBadge(preview.status)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
