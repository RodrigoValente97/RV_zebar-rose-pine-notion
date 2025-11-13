from notion_client import Client

api=""  # Replace with your FULL token
db_id=""  # Replace with your database ID

client = Client(auth=api)

# Retrieve database info
db = client.databases.retrieve(database_id=db_id)
print("✅ Database is ACCESSIBLE")

# Query database pages
pages = client.databases.query(database_id=db_id)
print("✅ Query SUCCESSFUL")

# Check for Title property
props = db.get('properties', {})
if 'Title' in props:
    print("✅ Has 'Title' property")
else:
    print("❌ Missing 'Title' property")

for i, prop in enumerate(props):
    print(f"props[{i}]", prop)
