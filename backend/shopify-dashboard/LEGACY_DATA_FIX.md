# 🔄 Legacy Data Visibility Fix

## Problem
Previously created segments, campaigns, and journeys were not visible because they didn't have a `storeId` field or had legacy values (null, 'default', empty string). The strict filtering was hiding all this data.

## Solution
Updated all API routes to use **flexible filtering** that includes:
1. **User's store data** (matching their storeId/assignedStoreId)
2. **Legacy data** (null, 'default', empty string, or missing storeId)

---

## ✅ Changes Made

### 1. `/api/segments/route.ts`
**Before**: Only showed segments with exact storeId match  
**After**: Shows user's store segments + all legacy segments

```typescript
// ADMIN: Sees everything
// STORE_OWNER: Sees their store + legacy data
// USER: Sees assigned store + legacy data
```

### 2. `/api/campaigns/route.ts`
**Before**: Only showed campaigns with exact storeId match  
**After**: Shows user's store campaigns + all legacy campaigns

### 3. `/api/journeys/route.ts`
**Before**: Only showed journeys with exact storeId match  
**After**: Shows user's store journeys + all legacy journeys

---

## 📊 What Each Role Sees Now

### ADMIN
- ✅ **All segments** (from all stores)
- ✅ **All campaigns** (from all stores)
- ✅ **All journeys** (from all stores)
- ✅ **All legacy data** (no storeId or default values)

### STORE_OWNER
- ✅ **Their store's segments** (matching their storeId)
- ✅ **Their store's campaigns** (matching their storeId)
- ✅ **Their store's journeys** (matching their storeId)
- ✅ **All legacy data** (null/default/empty storeId)

### USER
- ✅ **Assigned store's segments** (matching assignedStoreId)
- ✅ **Assigned store's campaigns** (matching assignedStoreId)
- ✅ **Assigned store's journeys** (matching assignedStoreId)
- ✅ **All legacy data** (null/default/empty storeId)

---

## 🔍 Legacy Data Detection

The system now includes data that matches any of these conditions:
- `storeId === null`
- `storeId === 'default'`
- `storeId === ''`
- `storeId` is undefined/missing

This ensures all previously created data is visible regardless of when it was created.

---

## ✅ Testing

1. **Login as any role**
2. **Check Segments page** → Should see all your previously created segments
3. **Check Campaigns page** → Should see all your previously created campaigns
4. **Check Journeys page** → Should see all your previously created journeys

---

## 📝 Notes

- **No database migration needed** - This is a filtering logic change only
- **No data loss** - All existing data remains intact
- **Backward compatible** - Works with both old and new data formats
- **Future-proof** - New data with proper storeId will still be filtered correctly

---

## 🎯 Result

✅ **All previously created data is now visible**  
✅ **Role-based access control still works**  
✅ **Legacy data is accessible to all authorized users**  
✅ **No breaking changes to existing functionality**




