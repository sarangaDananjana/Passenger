from pymongo import MongoClient
from pymongo.errors import BulkWriteError

# 1. Connect to source and target
src_uri = "mongodb+srv://dananjanasaranga:A0763003258z@cluster0.fkjv2k4.mongodb.net/Passenger?retryWrites=true&w=majority&appName=Cluster0"
dst_uri = "mongodb://passenger:Iwantm0ney$@localhost:27017/PassengerDB?authSource=admin"

src_client = MongoClient(src_uri)
dst_client = MongoClient(dst_uri)

src_db = src_client["Passenger"]
dst_db = dst_client["Passenger"]

# 2. List the collections you want to copy
collections_to_copy = ["Admin", "AppVersion", "BoardingPoints",
                       "BusFare", "BusOwners", "FCMTokens", "Routes", "Users"]

for coll_name in collections_to_copy:
    src_coll = src_db[coll_name]
    dst_coll = dst_db[coll_name]

    # 3. Fetch all documents from source
    docs = list(src_coll.find())
    if not docs:
        print(f"No documents found in {coll_name}, skipping.")
        continue

    # 4. (Optional) If you want to overwrite existing docs, you can drop the target first:
    # dst_coll.drop()
    # Or, to upsert by _id, remove duplicates from the list:
    # unique_docs = {doc["_id"]: doc for doc in docs}.values()
    # docs = list(unique_docs)

    # 5. Insert into target
    try:
        result = dst_coll.insert_many(docs, ordered=False)
        print(f"Copied {len(result.inserted_ids)} docs into {coll_name}")
    except BulkWriteError as bwe:
        # If some _id’s already exist, you can catch duplicate‐key errors here
        write_errors = bwe.details.get("writeErrors", [])
        inserted = len(docs) - len(write_errors)
        print(
            f"Inserted {inserted} new docs into {coll_name} ({len(write_errors)} duplicates skipped)")

# 6. Close connections
src_client.close()
dst_client.close()
